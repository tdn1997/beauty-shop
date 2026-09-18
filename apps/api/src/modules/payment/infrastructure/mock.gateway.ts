import { DomainError } from '../../shared/domain/domain-error';
import { Result } from '../../shared/domain/result';
import { PaymentGateway, PaymentInitiation, PaymentOutcome } from '../application/payment-gateway';
import { PaymentStatus } from '../domain/payment-status';

export class MockGateway implements PaymentGateway {
  readonly provider = 'mock';
  readonly #script: readonly (PaymentStatus | Error)[];
  readonly #outcomes = new Map<string, PaymentOutcome>();
  #cursor = 0;

  private constructor(script: readonly (PaymentStatus | Error)[]) {
    this.#script = Object.freeze([...script]);
  }

  static scripted(script: readonly (PaymentStatus | Error)[]): MockGateway {
    return new MockGateway(script);
  }

  async initiate(initiation: PaymentInitiation): Promise<Result<PaymentOutcome>> {
    if (initiation.amount.isNegative()) {
      return Result.err(new DomainError('PAYMENT_AMOUNT_INVALID', 'Số tiền thanh toán không được âm'));
    }
    const entry = this.#script[this.#cursor] ?? PaymentStatus.Unknown;
    this.#cursor += 1;
    if (entry instanceof Error) throw entry;
    const providerRef = `mock_${this.#cursor}`;
    const outcome: PaymentOutcome = Object.freeze({
      status: entry,
      providerRef,
      redirectUrl: null,
      reason: entry === PaymentStatus.Failed ? 'Thẻ bị từ chối' : entry === PaymentStatus.Unknown ? 'Chưa rõ kết quả' : null,
    });
    this.#outcomes.set(providerRef, outcome);
    return Result.ok(outcome);
  }

  async query(providerRef: string): Promise<Result<PaymentOutcome>> {
    const outcome = this.#outcomes.get(providerRef);
    return outcome ? Result.ok(outcome) : Result.err(new DomainError('PAYMENT_REF_NOT_FOUND', 'Không tìm thấy mã thanh toán'));
  }
}
