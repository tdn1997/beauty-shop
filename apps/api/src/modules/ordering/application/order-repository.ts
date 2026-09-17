import { Order } from '../domain/order';

/**
 * Cổng lưu trữ đơn hàng — khai báo ở tầng application (nơi **cần** nó),
 * cài đặt ở infrastructure. Nhờ vậy ca sử dụng không biết Prisma tồn tại.
 *
 * Repository không tự mở/đóng transaction: ranh giới transaction do
 * application service quyết định.
 */
export interface OrderRepository {
  findById(id: string): Promise<Order | null>;
  save(order: Order): Promise<void>;
}
