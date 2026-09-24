import { createHash } from 'node:crypto';
import { DomainError } from '../../shared/domain/domain-error';
import { Result } from '../../shared/domain/result';
import { CurrencyCode } from '../../shared/domain/money';
import { Clock } from '../../shared/domain/clock';
import { IdempotencyStore } from '../../shared/application/idempotency-store';
import { TransactionManager } from '../../shared/application/transaction-manager';
import { QuoteService } from '../../pricing/application/quote.service';
import { QuoteDto } from '../../pricing/domain/quote';
import { PaymentGatewayRegistry } from '../../payment/application/payment-gateway.registry';
import { PaymentOutcome } from '../../payment/application/payment-gateway';
import { PaymentStatus } from '../../payment/domain/payment-status';
import { OutboxRepository } from '../../notification/application/outbox-repository';
import { OutboxEvent } from '../../notification/domain/outbox-event';
import { Order } from '../domain/order';
import { OrderRepository } from './order-repository';
import { AddressBook, InventoryAllocation } from './checkout-ports';

export interface CheckoutRequest {
  readonly addressId: string;
  readonly currency: CurrencyCode;
  readonly lines: readonly { readonly variantId: string; readonly quantity: number }[];
}

export interface CheckoutResponse {
  readonly orderId: string;
  readonly quote: QuoteDto;
  readonly paymentRequest: {
    readonly orderId: string;
    readonly provider: string;
    readonly returnUrl: string;
  };
  readonly payment: PaymentOutcome;
}

export interface CheckoutDependencies {
  readonly addresses: AddressBook;
  readonly inventory: InventoryAllocation;
  readonly quotes: Pick<QuoteService, 'quoteFor'>;
  readonly orders: Pick<OrderRepository, 'save'>;
  readonly outbox: Pick<OutboxRepository, 'append'>;
  readonly replay: Pick<IdempotencyStore, 'find' | 'reserve' | 'complete'>;
  readonly transactions: TransactionManager;
  readonly gateways: PaymentGatewayRegistry;
  readonly clock: Clock;
  readonly nextId: () => string;
  readonly returnUrl: string;
}

export class CheckoutService {
  constructor(private readonly dependencies: CheckoutDependencies) {}

  async placeOrder(
    principal: { readonly customerId: string } | null | undefined,
    key: string,
    request: CheckoutRequest,
  ): Promise<Result<CheckoutResponse>> {
    if (!principal?.customerId?.trim())
      return Result.err(new DomainError('UNAUTHENTICATED', 'A trusted principal is required'));
    const d = this.dependencies;
    const customerId = principal.customerId;
    const address = await d.addresses.findOwned(customerId, request.addressId);
    if (!address)
      return Result.err(
        new DomainError('ADDRESS_NOT_OWNED', 'Address is not available to this customer'),
      );
    if (!key?.trim())
      return Result.err(new DomainError('INVALID_IDEMPOTENCY_KEY', 'Idempotency-Key is required'));
    const requestHash = createHash('sha256')
      .update(
        JSON.stringify({
          addressId: request.addressId,
          currency: request.currency,
          lines: request.lines.map(({ variantId, quantity }) => ({ variantId, quantity })),
        }),
      )
      .digest('hex');
    const existing = await d.replay.find(customerId, key);
    if (existing) {
      if (existing.requestHash !== requestHash)
        return Result.err(
          new DomainError('IDEMPOTENCY_KEY_REUSED', 'Key was used for another request'),
        );
      if (existing.status !== 'COMPLETED')
        return Result.err(
          new DomainError('IDEMPOTENCY_IN_PROGRESS', 'Checkout is still in progress'),
        );
      return Result.ok(existing.response as CheckoutResponse);
    }
    const quoted = await d.quotes.quoteFor({
      customerId,
      currency: request.currency,
      province: address.toJSON().province,
      lines: request.lines,
    });
    if (quoted.isErr()) return Result.err(quoted.errorOrNull()!);
    const quote = quoted.unwrap();
    const gateway = d.gateways.default();
    const order = Order.draft({ id: d.nextId(), customerId, currency: quote.currency });
    for (const line of quote.lines)
      order.addQuotedLine({
        variantId: line.variantId,
        sku: line.sku,
        nameSnapshot: line.nameSnapshot,
        unitPriceSnapshot: line.unitPrice,
        quantity: line.quantity,
      });
    order.applyQuotedAdjustments(quote.discountTotal(), quote.shippingFee());
    order.shipTo(address);
    order.confirm();
    const response: CheckoutResponse = {
      orderId: order.id,
      quote: quote.toDto(),
      paymentRequest: { orderId: order.id, provider: gateway.provider, returnUrl: d.returnUrl },
      payment: {
        status: PaymentStatus.Unknown,
        providerRef: null,
        redirectUrl: null,
        reason: 'Payment requires reconciliation; do not initiate again',
      },
    };
    try {
      await d.transactions.run(async () => {
        if (!(await d.replay.reserve(customerId, key, requestHash)))
          throw new DomainError('IDEMPOTENCY_IN_PROGRESS', 'Checkout is still in progress');
        for (const line of quote.lines)
          (await d.inventory.reserveForVariant(line.variantId, line.quantity)).unwrap();
        (await d.orders.save(order)).unwrap();
        (
          await d.outbox.append(
            OutboxEvent.record(
              {
                id: `${order.id}:confirmed`,
                eventType: 'ORDER_CONFIRMED',
                aggregateId: order.id,
                payload: { orderId: order.id, customerId },
              },
              d.clock,
            ),
          )
        ).unwrap();
        await d.replay.complete(customerId, key, response);
      });
    } catch (error) {
      if (error instanceof DomainError) return Result.err(error);
      throw error;
    }
    const outcome = await gateway.initiate({
      orderId: order.id,
      amount: order.grandTotal(),
      returnUrl: d.returnUrl,
    });
    if (outcome.isErr()) return Result.ok(response);
    const payment = outcome.unwrap();
    const completed = { ...response, payment };
    if (payment.status !== PaymentStatus.Paid) {
      await d.replay.complete(customerId, key, completed);
      return Result.ok(completed);
    }
    // Trạng thái đơn và phản hồi replay "đã trả" phải cùng commit: lỡ một nửa thì
    // lần retry sẽ báo PAID cho đơn vẫn CONFIRMED (hoặc ngược lại). Lỗi ở đây xảy ra
    // sau khi tiền đã trừ → để nổi lên, retry trả UNKNOWN đã lưu chứ không trừ lại.
    order.markPaid();
    await d.transactions.run(async () => {
      (await d.orders.save(order)).unwrap();
      await d.replay.complete(customerId, key, completed);
    });
    return Result.ok(completed);
  }
}
