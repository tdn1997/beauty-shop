import { Result } from '../../shared/domain/result';
import { OutboxEvent } from '../domain/outbox-event';

/**
 * Cổng lưu trữ hộp thư đi — khai báo ở application, cài đặt ở infrastructure.
 *
 * `append` được gọi **bên trong** transaction ghi đơn: đơn và lời hứa gửi thông
 * báo cùng commit hoặc cùng biến mất. `findPending` / `save` là việc của worker,
 * chạy **ngoài** transaction đó.
 */
export interface OutboxRepository {
  /** Ghi sự kiện mới. Gọi trong cùng transaction với việc ghi aggregate sinh ra nó. */
  append(event: OutboxEvent): Promise<Result<void>>;

  /** Những sự kiện còn chờ gửi, cũ trước mới sau, nhiều nhất `limit` cái. */
  findPending(limit: number): Promise<readonly OutboxEvent[]>;

  /**
   * Ghi lại kết quả một lần gửi. Dùng optimistic lock: thua cuộc đua thì trả
   * `Result.err('CONCURRENT_MODIFICATION')` — vòng sau nhặt lại, không ghi đè.
   */
  save(event: OutboxEvent): Promise<Result<void>>;
}
