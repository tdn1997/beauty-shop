import { createHash } from 'node:crypto';

import { DomainError } from '../domain/domain-error';
import { Result } from '../domain/result';
import { IdempotencyStore } from './idempotency-store';

export interface IdempotentRequest {
  readonly customerId: string;
  readonly key: string;
  readonly body: unknown;
}

/**
 * Đảm bảo một thao tác chỉ chạy đúng một lần cho mỗi (khách, Idempotency-Key).
 *
 * Bấm "Đặt hàng" hai lần, hay client tự retry khi mạng chập chờn, đều phải
 * ra cùng một đơn — không phải hai. Body được băm lại để cùng một khoá
 * không thể dùng cho một nội dung giỏ khác.
 */
export class IdempotencyService {
  readonly #store: IdempotencyStore;

  constructor(store: IdempotencyStore) {
    this.#store = store;
  }

  async run<T>(request: IdempotentRequest, handler: () => Promise<T>): Promise<Result<T>> {
    const requestHash = hashBody(request.body);
    const existing = await this.#store.find(request.customerId, request.key);

    if (existing) {
      if (existing.requestHash !== requestHash) {
        return Result.err(
          new DomainError(
            'IDEMPOTENCY_KEY_REUSED',
            'Khoá idempotency đã dùng cho một nội dung khác',
            { key: request.key },
          ),
        );
      }
      if (existing.status === 'IN_PROGRESS') {
        return Result.err(
          new DomainError('IDEMPOTENCY_IN_PROGRESS', 'Yêu cầu trước còn đang xử lý', {
            key: request.key,
          }),
        );
      }
      return Result.ok(existing.response as T);
    }

    const reserved = await this.#store.reserve(request.customerId, request.key, requestHash);
    if (!reserved) {
      return Result.err(
        new DomainError('IDEMPOTENCY_IN_PROGRESS', 'Yêu cầu trước còn đang xử lý', {
          key: request.key,
        }),
      );
    }

    try {
      const response = await handler();
      await this.#store.complete(request.customerId, request.key, response);
      return Result.ok(response);
    } catch (error) {
      // Nhả khoá để client còn retry được; nếu giữ lại, một lỗi tạm thời
      // sẽ khoá vĩnh viễn nội dung giỏ đó.
      await this.#store.release(request.customerId, request.key);
      throw error;
    }
  }
}

/** Băm ổn định: thứ tự khoá trong JSON không được làm đổi kết quả. */
function hashBody(body: unknown): string {
  return createHash('sha256').update(stableStringify(body)).digest('hex');
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;

  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => (left < right ? -1 : 1))
    .map(([key, nested]) => `${JSON.stringify(key)}:${stableStringify(nested)}`);

  return `{${entries.join(',')}}`;
}
