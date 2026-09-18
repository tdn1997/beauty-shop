import { DomainError } from '../../shared/domain/domain-error';
import { requireNonBlank, requireState } from '../../shared/domain/guards';
import { Money } from '../../shared/domain/money';
import { PaymentStatus } from './payment-status';

export interface InitiatePaymentAttemptProps {
  readonly orderId: string;
  readonly provider: string;
  readonly amount: Money;
}

/** Trạng thái còn có thể đổi kết cục: chưa xong thì còn hỏi lại nhà cung cấp được. */
const UNSETTLED: readonly PaymentStatus[] = [PaymentStatus.Pending, PaymentStatus.Unknown];

/**
 * Một lần thử thanh toán cho một đơn.
 *
 * `#status` là riêng tư và chỉ đổi qua method có tên theo ý định
 * (`succeed` / `fail` / `markUnknown` / `awaitRedirect`) — không có `setStatus`.
 *
 * Bất biến then chốt: đã ngã ngũ (`PAID`/`FAILED`) thì không lật lại được.
 * `UNKNOWN` thì **chưa** ngã ngũ: đó là chỗ để việc đối soát sau này ghi kết quả
 * thật vào, nên nó vẫn cho phép `succeed`/`fail`.
 */
export class PaymentAttempt {
  readonly #orderId: string;
  readonly #provider: string;
  readonly #amount: Money;
  #status: PaymentStatus;
  #providerRef: string | null;
  #redirectUrl: string | null;
  #failureReason: string | null;

  private constructor(props: { orderId: string; provider: string; amount: Money }) {
    this.#orderId = props.orderId;
    this.#provider = props.provider;
    this.#amount = props.amount;
    this.#status = PaymentStatus.Pending;
    this.#providerRef = null;
    this.#redirectUrl = null;
    this.#failureReason = null;
  }

  static initiated(props: InitiatePaymentAttemptProps): PaymentAttempt {
    const orderId = requireNonBlank(props.orderId, 'orderId', 'INVALID_PAYMENT_ATTEMPT');
    const provider = requireNonBlank(props.provider, 'provider', 'INVALID_PAYMENT_ATTEMPT');
    if (props.amount.isNegative()) {
      throw new DomainError('PAYMENT_AMOUNT_INVALID', 'Số tiền thanh toán không được âm', {
        orderId,
        provider,
        amount: props.amount.toString(),
      });
    }

    return new PaymentAttempt({ orderId, provider, amount: props.amount });
  }

  get orderId(): string {
    return this.#orderId;
  }

  get provider(): string {
    return this.#provider;
  }

  get amount(): Money {
    return this.#amount;
  }

  get status(): PaymentStatus {
    return this.#status;
  }

  get providerRef(): string | null {
    return this.#providerRef;
  }

  get redirectUrl(): string | null {
    return this.#redirectUrl;
  }

  get failureReason(): string | null {
    return this.#failureReason;
  }

  /** Đã ngã ngũ: không còn gì để hỏi lại nhà cung cấp nữa. */
  isSettled(): boolean {
    return this.#status === PaymentStatus.Paid || this.#status === PaymentStatus.Failed;
  }

  isPending(): boolean {
    return this.#status === PaymentStatus.Pending;
  }

  /** Nhà cung cấp cần khách bấm tiếp trên trang của họ — vẫn đang chờ. */
  awaitRedirect(providerRef: string, redirectUrl: string): void {
    requireState(this.#status, [PaymentStatus.Pending], 'chờ khách thanh toán');
    const ref = requireNonBlank(providerRef, 'providerRef', 'INVALID_PAYMENT_ATTEMPT');
    const url = requireNonBlank(redirectUrl, 'redirectUrl', 'INVALID_PAYMENT_ATTEMPT');

    this.#providerRef = ref;
    this.#redirectUrl = url;
  }

  succeed(providerRef: string): void {
    requireState(this.#status, UNSETTLED, 'ghi nhận thanh toán thành công');
    const ref = requireNonBlank(providerRef, 'providerRef', 'INVALID_PAYMENT_ATTEMPT');

    this.#providerRef = ref;
    this.#status = PaymentStatus.Paid;
    this.#failureReason = null;
  }

  fail(reason: string): void {
    requireState(this.#status, UNSETTLED, 'ghi nhận thanh toán thất bại');
    const failureReason = requireNonBlank(reason, 'reason', 'INVALID_PAYMENT_ATTEMPT');

    this.#failureReason = failureReason;
    this.#status = PaymentStatus.Failed;
  }

  /**
   * Không xác định được kết cục. Chỉ đi từ `PENDING` — đã ngã ngũ rồi thì không
   * được "quên" lại, vì như vậy là xoá đi một sự thật đã biết chắc.
   */
  markUnknown(reason: string): void {
    requireState(this.#status, [PaymentStatus.Pending], 'đánh dấu chưa rõ kết quả');
    const unknownReason = requireNonBlank(reason, 'reason', 'INVALID_PAYMENT_ATTEMPT');

    this.#failureReason = unknownReason;
    this.#status = PaymentStatus.Unknown;
  }
}
