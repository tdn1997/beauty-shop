export type IdempotencyStatus = 'IN_PROGRESS' | 'COMPLETED';

export interface IdempotencyRecord {
  readonly customerId: string;
  readonly key: string;
  readonly requestHash: string;
  readonly status: IdempotencyStatus;
  readonly response: unknown;
}

/**
 * Cổng lưu vết khoá idempotency.
 *
 * `reserve` phải là thao tác **nguyên tử**: bản Postgres dựa vào
 * `UNIQUE (customer_id, key)` để hai request song song chỉ một cái giành được chỗ.
 */
export interface IdempotencyStore {
  find(customerId: string, key: string): Promise<IdempotencyRecord | null>;
  /** Trả về false nếu khoá đã bị chiếm — không ghi đè. */
  reserve(customerId: string, key: string, requestHash: string): Promise<boolean>;
  complete(customerId: string, key: string, response: unknown): Promise<void>;
  release(customerId: string, key: string): Promise<void>;
}
