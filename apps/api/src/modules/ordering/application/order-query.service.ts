import { OrderDto, toOrderDto } from './order.dto';
import { OrderRepository } from './order-repository';

/**
 * Phía TRUY VẤN. Chỉ đọc, trả DTO, không bao giờ đổi trạng thái —
 * nửa còn lại của nguyên tắc tách lệnh/truy vấn.
 */
export class OrderQueryService {
  readonly #orders: OrderRepository;

  constructor(orders: OrderRepository) {
    this.#orders = orders;
  }

  async findById(orderId: string): Promise<OrderDto | null> {
    const order = await this.#orders.findById(orderId);
    return order ? toOrderDto(order) : null;
  }
}
