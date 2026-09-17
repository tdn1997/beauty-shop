import { Result } from '../../shared/domain/result';
import { OrderRepository } from '../application/order-repository';
import { Order } from '../domain/order';

/**
 * Cài đặt tạm thời để chạy và test ca sử dụng khi chưa cắm DB.
 *
 * Không mô phỏng cạnh tranh: một `Map` trong bộ nhớ không có transaction,
 * nên "test cạnh tranh" ở đây sẽ là test xanh giả. Cạnh tranh thật được
 * chứng minh bằng Postgres ở Giai đoạn 7.
 */
export class InMemoryOrderRepository implements OrderRepository {
  readonly #orders = new Map<string, Order>();

  async findById(id: string): Promise<Order | null> {
    return this.#orders.get(id) ?? null;
  }

  async save(order: Order): Promise<Result<void>> {
    this.#orders.set(order.id, order);
    order.markPersisted();
    return Result.ok(undefined);
  }
}
