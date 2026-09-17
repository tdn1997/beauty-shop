import { DomainError } from '../../shared/domain/domain-error';
import { CurrencyCode, Money } from '../../shared/domain/money';
import { Result } from '../../shared/domain/result';
import { Address, AddressProps } from '../domain/address';
import { Order } from '../domain/order';
import { OrderRepository } from './order-repository';

export interface CreateDraftCommand {
  readonly orderId: string;
  readonly customerId: string;
  readonly currency: CurrencyCode;
}

export interface AddLineCommand {
  readonly orderId: string;
  readonly variantId: string;
  readonly sku: string;
  readonly nameSnapshot: string;
  readonly unitPrice: string;
  readonly quantity: number;
}

export interface SetShippingAddressCommand {
  readonly orderId: string;
  readonly address: AddressProps;
}

export interface OrderCommand {
  readonly orderId: string;
}

/**
 * Phía LỆNH. Chỉ đây mới được đổi trạng thái đơn hàng.
 *
 * Tình huống nghiệp vụ đã lường trước (không tìm thấy đơn, sai trạng thái, đơn rỗng)
 * trả về `Result`. Lỗi hạ tầng (mất kết nối) được để nguyên cho nổi lên trên —
 * nuốt nó ở đây sẽ biến sự cố thành "đơn đặt không thành công" một cách im lặng.
 */
export class OrderCommandService {
  readonly #orders: OrderRepository;

  constructor(orders: OrderRepository) {
    this.#orders = orders;
  }

  async createDraft(command: CreateDraftCommand): Promise<Result<void>> {
    return this.#attempt(async () => {
      const order = Order.draft({
        id: command.orderId,
        customerId: command.customerId,
        currency: command.currency,
      });
      return this.#orders.save(order);
    });
  }

  async addLine(command: AddLineCommand): Promise<Result<void>> {
    return this.#withOrder(command.orderId, async (order) => {
      order.addQuotedLine({
        variantId: command.variantId,
        sku: command.sku,
        nameSnapshot: command.nameSnapshot,
        unitPriceSnapshot: Money.parse(command.unitPrice, order.currency),
        quantity: command.quantity,
      });
    });
  }

  async setShippingAddress(command: SetShippingAddressCommand): Promise<Result<void>> {
    return this.#withOrder(command.orderId, async (order) => {
      order.shipTo(Address.create(command.address));
    });
  }

  async confirm(command: OrderCommand): Promise<Result<void>> {
    return this.#withOrder(command.orderId, async (order) => order.confirm());
  }

  async #withOrder(
    orderId: string,
    change: (order: Order) => void | Promise<void>,
  ): Promise<Result<void>> {
    const order = await this.#orders.findById(orderId);
    if (!order) {
      return Result.err(
        new DomainError('ORDER_NOT_FOUND', `Không tìm thấy đơn ${orderId}`, { orderId }),
      );
    }

    return this.#attempt(async () => {
      await change(order);
      return this.#orders.save(order);
    });
  }

  async #attempt(action: () => Promise<Result<void>>): Promise<Result<void>> {
    try {
      return await action();
    } catch (error) {
      // Chỉ lỗi nghiệp vụ mới thành Result; lỗi hạ tầng phải nổi lên.
      if (error instanceof DomainError) return Result.err(error);
      throw error;
    }
  }
}
