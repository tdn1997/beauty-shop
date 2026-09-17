import { Result } from '../../shared/domain/result';
import { Order } from '../domain/order';

/**
 * Cổng lưu trữ đơn hàng — khai báo ở tầng application (nơi **cần** nó),
 * cài đặt ở infrastructure. Nhờ vậy ca sử dụng không biết Prisma tồn tại.
 *
 * Repository không tự mở/đóng transaction: ranh giới transaction do
 * application service quyết định qua `TransactionManager`.
 */
export interface OrderRepository {
  findById(id: string): Promise<Order | null>;

  /**
   * Ghi đơn xuống kho lưu trữ.
   *
   * Trả `Result` chứ không ném: thua cuộc đua optimistic lock
   * (`CONCURRENT_MODIFICATION`) là tình huống **dự kiến** của hệ thống nhiều
   * người dùng, không phải lỗi lập trình. Sự cố hạ tầng thì ngược lại —
   * vẫn nổi lên thành exception, không được gói vào `Result`.
   */
  save(order: Order): Promise<Result<void>>;
}
