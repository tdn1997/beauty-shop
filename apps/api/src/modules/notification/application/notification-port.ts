import { Result } from '../../shared/domain/result';

/** Thứ thật sự được gửi đi — dữ liệu thuần, không phải aggregate. */
export interface Notification {
  readonly eventType: string;
  readonly aggregateId: string;
  readonly payload: Readonly<Record<string, unknown>>;
}

/**
 * Cổng gửi thông báo (GRASP Indirection).
 *
 * Ca sử dụng đặt hàng không bao giờ biết phía sau là email, SMS hay một dòng log:
 * nó chỉ ghi sự kiện vào outbox. Đổi nhà cung cấp là cắm một cài đặt khác ở
 * composition root, `CheckoutService` không đổi một dòng nào.
 *
 * Trả `Result`: "nhà cung cấp từ chối" là tình huống nghiệp vụ dự kiến, worker
 * phải thử lại. Mất kết nối / timeout thì **ném** — lỗi hạ tầng không gói vào `Result`.
 */
export interface NotificationPort {
  send(notification: Notification): Promise<Result<void>>;
}
