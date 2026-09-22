import { DomainError } from '../../shared/domain/domain-error';
import { Result } from '../../shared/domain/result';
import { PaymentGateway, PaymentInitiation, PaymentOutcome } from '../application/payment-gateway';
import { PaymentStatus } from '../domain/payment-status';

export interface SandboxHttpClient {
  post(url: string, body: unknown): Promise<{ status: number; body: unknown }>;
  get(url: string): Promise<{ status: number; body: unknown }>;
}

export class SandboxGateway implements PaymentGateway {
  readonly provider = 'sandbox';
  readonly #client: SandboxHttpClient;
  readonly #baseUrl: string;

  constructor(client: SandboxHttpClient, baseUrl: string) {
    this.#client = client;
    this.#baseUrl = baseUrl.replace(/\/$/, '');
  }

  async initiate(initiation: PaymentInitiation): Promise<Result<PaymentOutcome>> {
    if (initiation.amount.isNegative()) {
      return Result.err(
        new DomainError('PAYMENT_AMOUNT_INVALID', 'Số tiền thanh toán không được âm'),
      );
    }
    let response: { status: number; body: unknown };
    try {
      response = await this.#client.post(`${this.#baseUrl}/payments`, {
        orderId: initiation.orderId,
        ...initiation.amount.toJSON(),
        returnUrl: initiation.returnUrl,
      });
    } catch (error) {
      // Timeout khi tạo giao dịch không chứng minh tiền chưa bị trừ; chỉ ngoại lệ này được đối soát bằng UNKNOWN.
      if (isRecord(error) && (error.code === 'ETIMEDOUT' || error.name === 'TimeoutError')) {
        return Result.ok(unknownOutcome(null));
      }
      throw error;
    }
    return Result.ok(mapResponse(response));
  }

  async query(providerRef: string): Promise<Result<PaymentOutcome>> {
    const response = await this.#client.get(
      `${this.#baseUrl}/payments/${encodeURIComponent(providerRef)}`,
    );
    if (response.status === 404) {
      return Result.err(new DomainError('PAYMENT_REF_NOT_FOUND', 'Không tìm thấy mã thanh toán'));
    }
    return Result.ok(mapResponse(response));
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function unknownOutcome(providerRef: string | null): PaymentOutcome {
  return Object.freeze({
    status: PaymentStatus.Unknown,
    providerRef,
    redirectUrl: null,
    reason: 'Chưa xác định được kết quả thanh toán',
  });
}

function mapResponse(response: { status: number; body: unknown }): PaymentOutcome {
  const body = response.body;
  if (!isRecord(body)) return unknownOutcome(null);
  const reference =
    typeof body.reference === 'string' && body.reference.trim() !== '' ? body.reference : null;
  if (response.status < 200 || response.status >= 300 || reference === null)
    return unknownOutcome(reference);
  const statuses: Readonly<Record<string, PaymentStatus>> = {
    PENDING: PaymentStatus.Pending,
    PAID: PaymentStatus.Paid,
    DECLINED: PaymentStatus.Failed,
    FAILED: PaymentStatus.Failed,
    UNKNOWN: PaymentStatus.Unknown,
  };
  const status =
    typeof body.status === 'string' && Object.hasOwn(statuses, body.status)
      ? statuses[body.status]
      : undefined;
  if (
    !status ||
    (body.redirectUrl != null && typeof body.redirectUrl !== 'string') ||
    (body.reason != null && typeof body.reason !== 'string')
  ) {
    return unknownOutcome(reference);
  }
  return Object.freeze({
    status,
    providerRef: reference,
    redirectUrl: typeof body.redirectUrl === 'string' ? body.redirectUrl : null,
    reason: typeof body.reason === 'string' ? body.reason : null,
  });
}
