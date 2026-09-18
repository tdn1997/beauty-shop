import { OrderDto, toOrderDto } from './order.dto';
import { OrderRepository } from './order-repository';

export class OrderQueryService {
  readonly #orders: OrderRepository;

  constructor(orders: OrderRepository) {
    this.#orders = orders;
  }

  async findById(orderId: string): Promise<OrderDto | null> {
    const order = await this.#orders.findById(orderId);
    return order ? toOrderDto(order) : null;
  }

  async listOrders(page: number, limit: number): Promise<{ orders: OrderDto[]; total: number }> {
    return this.#orders.list(page, limit);
  }
}
