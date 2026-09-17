import { OrderRepository } from '../application/order-repository';
import { Order } from '../domain/order';

/**
 * Cài đặt tạm thời để chạy và test ca sử dụng khi chưa có DB.
 * Phiên bản Prisma sẽ thay thế nó ở Giai đoạn 5 mà không đụng tới application.
 */
export class InMemoryOrderRepository implements OrderRepository {
  readonly #orders = new Map<string, Order>();

  async findById(id: string): Promise<Order | null> {
    return this.#orders.get(id) ?? null;
  }

  async save(order: Order): Promise<void> {
    this.#orders.set(order.id, order);
  }
}
