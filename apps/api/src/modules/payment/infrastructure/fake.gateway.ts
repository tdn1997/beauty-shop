import { DomainError } from '../../shared/domain/domain-error';
import { Result } from '../../shared/domain/result';
import { PaymentGateway, PaymentInitiation, PaymentOutcome } from '../application/payment-gateway';
import { PaymentStatus } from '../domain/payment-status';

type Decision = (initiation: PaymentInitiation) => PaymentStatus;

const REASONS: Readonly<Record<PaymentStatus, string | null>> = {
  [PaymentStatus.Paid]: null,
  [PaymentStatus.Pending]: 'Đang chờ xác nhận thanh toán',
  [PaymentStatus.Failed]: 'Thanh toán bị từ chối',
  [PaymentStatus.Unknown]: 'Chưa rõ kết quả thanh toán',
};

/**
 * Cổng thanh toán giả dùng khi chưa có nhà cung cấp thật: trả kết quả ngay,
 * không chuyển hướng. Khác `MockGateway` (kịch bản tuần tự cho test), cổng này
 * quyết định theo từng lần gọi và **mỗi đơn chỉ bị trừ tiền một lần** — gọi lại
 * cho cùng `orderId` trả đúng kết cục cũ, giống idempotency của cổng thật.
 */
export class FakeGateway implements PaymentGateway {
  readonly provider = 'fake';
  readonly #decide: Decision;
  readonly #byRef = new Map<string, PaymentOutcome>();

  private constructor(decide: Decision) {
    this.#decide = decide;
  }

  /** Chấp nhận mọi khoản thanh toán hợp lệ. */
  static approving(): FakeGateway {
    return new FakeGateway(() => PaymentStatus.Paid);
  }

  static deciding(decide: Decision): FakeGateway {
    return new FakeGateway(decide);
  }

  async initiate(initiation: PaymentInitiation): Promise<Result<PaymentOutcome>> {
    if (initiation.amount.isNegative())
      return Result.err(
        new DomainError('PAYMENT_AMOUNT_INVALID', 'Số tiền thanh toán không được âm'),
      );
    const providerRef = `fake_${initiation.orderId}`;
    const existing = this.#byRef.get(providerRef);
    if (existing) return Result.ok(existing);
    const status = this.#decide(initiation);
    const outcome: PaymentOutcome = Object.freeze({
      status,
      providerRef,
      redirectUrl: null,
      reason: REASONS[status],
    });
    this.#byRef.set(providerRef, outcome);
    return Result.ok(outcome);
  }

  async query(providerRef: string): Promise<Result<PaymentOutcome>> {
    const outcome = this.#byRef.get(providerRef);
    return outcome
      ? Result.ok(outcome)
      : Result.err(new DomainError('PAYMENT_REF_NOT_FOUND', 'Không tìm thấy mã thanh toán'));
  }
}
