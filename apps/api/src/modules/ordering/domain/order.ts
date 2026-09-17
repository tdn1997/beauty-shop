import { DomainError } from '../../shared/domain/domain-error';
import { requireNonBlank, requireState } from '../../shared/domain/guards';
import { CurrencyCode, Money } from '../../shared/domain/money';
import { Address } from './address';
import { OrderLine } from './order-line';

export enum OrderStatus {
  Draft = 'DRAFT',
  Confirmed = 'CONFIRMED',
  Paid = 'PAID',
  Dispatched = 'DISPATCHED',
  Cancelled = 'CANCELLED',
}

export interface DraftOrderProps {
  readonly id: string;
  readonly customerId: string;
  readonly currency: CurrencyCode;
}

export interface QuotedLineProps {
  readonly variantId: string;
  readonly sku: string;
  readonly nameSnapshot: string;
  readonly unitPriceSnapshot: Money;
  readonly quantity: number;
}

const EDITABLE: readonly OrderStatus[] = [OrderStatus.Draft];
const CANCELLABLE: readonly OrderStatus[] = [
  OrderStatus.Draft,
  OrderStatus.Confirmed,
  OrderStatus.Paid,
];

/**
 * Aggregate root của đơn hàng.
 *
 * - `#lines` là riêng tư: bên ngoài không `new OrderLine()` rồi nhét vào được,
 *   mọi dòng đều do chính đơn hàng tạo (GRASP Creator).
 * - Chuyển trạng thái đi qua method có tên theo ý định; không có `setStatus`.
 * - `#version` phục vụ optimistic lock ở tầng lưu trữ.
 */
export class Order {
  readonly #id: string;
  readonly #customerId: string;
  readonly #currency: CurrencyCode;
  readonly #lines: OrderLine[];
  #status: OrderStatus;
  #shippingAddress: Address | null;
  #cancellationReason: string | null;
  #version: number;

  private constructor(props: DraftOrderProps) {
    this.#id = props.id;
    this.#customerId = props.customerId;
    this.#currency = props.currency;
    this.#lines = [];
    this.#status = OrderStatus.Draft;
    this.#shippingAddress = null;
    this.#cancellationReason = null;
    this.#version = 0;
  }

  static draft(props: DraftOrderProps): Order {
    const id = requireNonBlank(props.id, 'id', 'INVALID_ORDER');
    const customerId = requireNonBlank(props.customerId, 'customerId', 'INVALID_ORDER');
    return new Order({ id, customerId, currency: props.currency });
  }

  get id(): string {
    return this.#id;
  }

  get customerId(): string {
    return this.#customerId;
  }

  get currency(): CurrencyCode {
    return this.#currency;
  }

  get status(): OrderStatus {
    return this.#status;
  }

  get version(): number {
    return this.#version;
  }

  get cancellationReason(): string | null {
    return this.#cancellationReason;
  }

  get shippingAddress(): Address | null {
    return this.#shippingAddress;
  }

  /** Bản chụp đông cứng: người gọi không thể thêm/bớt dòng qua getter này. */
  get lines(): readonly OrderLine[] {
    return Object.freeze([...this.#lines]);
  }

  addQuotedLine(props: QuotedLineProps): void {
    requireState(this.#status, EDITABLE, 'addQuotedLine');
    this.#requireSameCurrency(props.unitPriceSnapshot);

    const existing = this.#lines.find((line) => line.variantId === props.variantId);
    if (existing) {
      if (!existing.unitPriceSnapshot.equals(props.unitPriceSnapshot)) {
        throw new DomainError('PRICE_CHANGED', 'Giá báo khác với giá đang có trong đơn', {
          variantId: props.variantId,
          inOrder: existing.unitPriceSnapshot.toString(),
          quoted: props.unitPriceSnapshot.toString(),
        });
      }
      existing.changeQuantity(existing.quantity + props.quantity);
      this.#touch();
      return;
    }

    this.#lines.push(OrderLine.create(props));
    this.#touch();
  }

  changeLineQuantity(variantId: string, quantity: number): void {
    requireState(this.#status, EDITABLE, 'changeLineQuantity');
    this.#requireLine(variantId).changeQuantity(quantity);
    this.#touch();
  }

  removeLine(variantId: string): void {
    requireState(this.#status, EDITABLE, 'removeLine');
    const index = this.#lines.indexOf(this.#requireLine(variantId));
    this.#lines.splice(index, 1);
    this.#touch();
  }

  shipTo(address: Address): void {
    requireState(this.#status, EDITABLE, 'shipTo');
    // Chụp lại địa chỉ: khách sửa sổ địa chỉ sau này không được đụng tới đơn đã đặt.
    this.#shippingAddress = Address.create(address.toJSON());
    this.#touch();
  }

  /** Information Expert: đơn hàng tự cộng thành tiền từ các dòng của chính nó. */
  itemsTotal(): Money {
    return this.#lines.reduce(
      (total, line) => total.add(line.subtotal()),
      Money.zero(this.#currency),
    );
  }

  confirm(): void {
    requireState(this.#status, [OrderStatus.Draft], 'confirm');
    if (this.#lines.length === 0) {
      throw new DomainError('EMPTY_ORDER', 'Đơn hàng phải có ít nhất một dòng', {
        orderId: this.#id,
      });
    }
    if (this.#shippingAddress === null) {
      throw new DomainError('MISSING_SHIPPING_ADDRESS', 'Đơn hàng chưa có địa chỉ giao', {
        orderId: this.#id,
      });
    }
    this.#status = OrderStatus.Confirmed;
    this.#touch();
  }

  markPaid(): void {
    requireState(this.#status, [OrderStatus.Confirmed], 'markPaid');
    this.#status = OrderStatus.Paid;
    this.#touch();
  }

  dispatch(): void {
    requireState(this.#status, [OrderStatus.Paid], 'dispatch');
    this.#status = OrderStatus.Dispatched;
    this.#touch();
  }

  cancel(reason: string): void {
    requireState(this.#status, CANCELLABLE, 'cancel');
    this.#cancellationReason = requireNonBlank(reason, 'reason', 'INVALID_ORDER');
    this.#status = OrderStatus.Cancelled;
    this.#touch();
  }

  #requireLine(variantId: string): OrderLine {
    const line = this.#lines.find((candidate) => candidate.variantId === variantId);
    if (!line) {
      throw new DomainError('LINE_NOT_FOUND', `Đơn không có dòng cho biến thể ${variantId}`, {
        orderId: this.#id,
        variantId,
      });
    }
    return line;
  }

  #requireSameCurrency(price: Money): void {
    if (price.currency !== this.#currency) {
      throw new DomainError(
        'CURRENCY_MISMATCH',
        `Đơn hàng tính bằng ${this.#currency}, không nhận ${price.currency}`,
        { expected: this.#currency, received: price.currency },
      );
    }
  }

  #touch(): void {
    this.#version += 1;
  }
}
