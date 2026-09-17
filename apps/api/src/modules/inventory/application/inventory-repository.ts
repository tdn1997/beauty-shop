import { Result } from '../../shared/domain/result';
import { InventoryLot } from '../domain/inventory-lot';

/**
 * Cổng lưu trữ kho — khai báo ở application, cài đặt ở infrastructure.
 *
 * Chỉ có đúng hai phương thức vì hiện chỉ có đúng hai chỗ cần. `save` sẽ được
 * thêm kèm test khi có ca sử dụng thật cần ghi lại cả lô (nhập hàng, khoá lô).
 */
export interface InventoryRepository {
  findById(id: string): Promise<InventoryLot | null>;

  /**
   * Giữ chỗ `quantity` trong lô `lotId`.
   *
   * Hợp đồng: phải làm bằng **một** câu lệnh có điều kiện, không đọc-rồi-ghi.
   * Đọc tồn rồi mới ghi để lại một khe thời gian giữa hai lệnh, và hai khách
   * cùng chen vào khe đó sẽ cùng được duyệt trên cùng một lượng hàng.
   *
   * Trả `Result`: hết hàng / lô bị khoá / lô hết hạn đều là tình huống nghiệp vụ
   * dự kiến, mỗi thứ một mã ổn định để client phân nhánh.
   */
  reserve(lotId: string, quantity: number): Promise<Result<void>>;
}
