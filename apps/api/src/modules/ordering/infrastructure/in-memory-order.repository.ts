import { Result } from '../../shared/domain/result';
import { OrderRepository, PaginatedOrders } from '../application/order-repository';
import { Order } from '../domain/order';
import { toOrderDto } from '../application/order.dto';

export class InMemoryOrderRepository implements OrderRepository {
  readonly #orders = new Map<string, Order>();

  async findById(id: string): Promise<Order | null> {
    return this.#orders.get(id) ?? null;
  }

  async list(page: number, limit: number): Promise<PaginatedOrders> {
    const allOrders = [...this.#orders.values()].sort((a, b) => a.id.localeCompare(b.id));
    const total = allOrders.length;
    const skip = (page - 1) * limit;
    const orders = allOrders.slice(skip, skip + limit).map(toOrderDto);
    return { orders, total };
  }

  async save(order: Order): Promise<Result<void>> {
    this.#orders.set(order.id, order);
    order.markPersisted();
    return Result.ok(undefined);
  }
}
