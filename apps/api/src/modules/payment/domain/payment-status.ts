/**
 * Kết cục của một lần thanh toán.
 *
 * `UNKNOWN` là trạng thái hạng nhất, **không** được quy về `FAILED`.
 * Lý do: khi nhà cung cấp trả 5xx hoặc timeout, tiền có thể đã bị trừ mà ta
 * không biết. Gọi nó là `FAILED` tức là nói dối khách rằng họ chưa mất tiền,
 * và mở nút "trả lại" cho một đơn có thể đã thanh toán thành công.
 * Giai đoạn 6 của kế hoạch yêu cầu đúng điều này: `UNKNOWN` → hiện
 * "đang kiểm tra", ẩn nút trả lại, rồi đối soát lại bằng `PaymentGateway.query`.
 */
export enum PaymentStatus {
  Pending = 'PENDING',
  Paid = 'PAID',
  Failed = 'FAILED',
  Unknown = 'UNKNOWN',
}
