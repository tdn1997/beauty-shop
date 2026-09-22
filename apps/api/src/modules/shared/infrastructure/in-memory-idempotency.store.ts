import { IdempotencyRecord, IdempotencyStore } from '../application/idempotency-store';

/**
 * Bản chạy trong bộ nhớ. Bản Postgres sẽ thay vào ở Giai đoạn 5,
 * dựa trên `UNIQUE (customer_id, key)` để giữ đúng tính nguyên tử của `reserve`.
 */
export class InMemoryIdempotencyStore implements IdempotencyStore {
  readonly #records = new Map<string, IdempotencyRecord>();

  async find(customerId: string, key: string): Promise<IdempotencyRecord | null> {
    return this.#records.get(compositeKey(customerId, key)) ?? null;
  }

  async reserve(customerId: string, key: string, requestHash: string): Promise<boolean> {
    const id = compositeKey(customerId, key);
    if (this.#records.has(id)) return false;

    this.#records.set(id, {
      customerId,
      key,
      requestHash,
      status: 'IN_PROGRESS',
      response: null,
    });
    return true;
  }

  async complete(customerId: string, key: string, response: unknown): Promise<void> {
    const id = compositeKey(customerId, key);
    const existing = this.#records.get(id);
    if (!existing) return;

    this.#records.set(id, { ...existing, status: 'COMPLETED', response });
  }

  async release(customerId: string, key: string): Promise<void> {
    this.#records.delete(compositeKey(customerId, key));
  }
}

function compositeKey(customerId: string, key: string): string {
  return `${customerId}::${key}`;
}
