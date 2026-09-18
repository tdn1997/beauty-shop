import { Money } from '../../shared/domain/money';
import { Result } from '../../shared/domain/result';
import { PaymentStatus } from '../domain/payment-status';

/** Yêu cầu mở một lần thanh toán. Tiền luôn là `Money`, không bao giờ `number`. */
export interface PaymentInitiation {
  readonly orderId: string;
  readonly amount: Money;
  readonly returnUrl: string;
}

/**
 * Kết cục do nhà cung cấp trả về, đã dịch sang ngôn ngữ của ta.
 *
 * `redirectUrl` chỉ có khi khách còn phải bấm tiếp trên trang nhà cung cấp;
 * `reason` là lời giải thích cho `FAILED`/`UNKNOWN`, dùng để hiển thị và ghi log.
 */
export interface PaymentOutcome {
  readonly status: PaymentStatus;
  readonly providerRef: string | null;
  readonly redirectUrl: string | null;
  readonly reason: string | null;
}

/**
 * Cổng thanh toán — đúng **hai** phương thức, và đó là chủ ý (GRASP Low Coupling).
 * Thêm nhà cung cấp mới không phải sửa `Order`, cũng không kéo SDK nào vào domain:
 * domain chỉ biết `PaymentStatus`, còn hình dạng dây của từng nhà cung cấp nằm
 * trọn trong `infrastructure/`.
 *
 * Phân loại lỗi — đây là phần dễ làm sai nhất, nên nói rõ:
 *
 * - Thẻ bị từ chối, hết hạn, không đủ số dư → đó là **kết quả nghiệp vụ dự kiến**:
 *   `Result.ok(PaymentOutcome{ status: Failed })`. Nhà cung cấp đã trả lời, ta
 *   biết chắc chuyện gì xảy ra. `Result.err` ở đây sẽ bắt lời gọi phải bóc lỗi
 *   ra để đọc một sự thật hoàn toàn bình thường.
 * - `Result.err` dành cho việc **không gọi được/không hỏi được**: số tiền vô lệ
 *   (`PAYMENT_AMOUNT_INVALID`), mã tham chiếu không tồn tại (`PAYMENT_REF_NOT_FOUND`).
 * - Sự cố hạ tầng (mất mạng, timeout ở tầng socket) thì **để nổi lên** — không
 *   gói vào `Result`, không nuốt. Nhưng nếu nhà cung cấp trả 5xx/không đọc được
 *   *trên một lần `initiate` có thể đã trừ tiền*, cài đặt phải trả
 *   `Result.ok(PaymentOutcome{ status: Unknown })` chứ không `Failed`.
 */
export interface PaymentGateway {
  readonly provider: string;

  initiate(initiation: PaymentInitiation): Promise<Result<PaymentOutcome>>;

  /** Đối soát lại theo mã tham chiếu — đường thoát cho một lần `UNKNOWN`. */
  query(providerRef: string): Promise<Result<PaymentOutcome>>;
}
