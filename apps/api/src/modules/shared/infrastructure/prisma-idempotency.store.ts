import {
  IdempotencyRecord,
  IdempotencyStatus,
  IdempotencyStore,
} from '../application/idempotency-store';
import { PrismaClientSource } from './prisma-client-source';

/** Hàng trong bảng `idempotency_record`. Khoá chính là cặp (customer_id, key). */
export interface IdempotencyRow {
  readonly customerId: string;
  readonly key: string;
  readonly requestHash: string;
  readonly status: IdempotencyStatus;
  readonly response: unknown;
}

type CompositeKey = { customerId_key: { customerId: string; key: string } };

/** Đúng phần Prisma mà kho này đụng tới. */
export interface IdempotencyPrismaClient {
  idempotencyRecord: {
    findUnique(args: { where: CompositeKey }): Promise<IdempotencyRow | null>;
    create(args: { data: IdempotencyRow }): Promise<unknown>;
    update(args: {
      where: CompositeKey;
      data: { status: 'COMPLETED'; response: unknown };
    }): Promise<unknown>;
    delete(args: { where: CompositeKey }): Promise<unknown>;
  };
}

/** Mã lỗi trùng khoá của Prisma — chính là `UNIQUE (customer_id, key)` bật lại. */
const UNIQUE_VIOLATION = 'P2002';

/**
 * Cài đặt `IdempotencyStore` bằng Postgres.
 *
 * `reserve` là **một lệnh INSERT**, không phải "đọc xem có chưa rồi mới ghi":
 * hai request song song cùng khoá thì đúng một cái ghi được, cái kia vấp ràng
 * buộc duy nhất và biết mình thua. Đọc trước rồi ghi sau sẽ để lọt cả hai khi
 * chúng cùng đọc thấy "chưa có".
 */
export class PrismaIdempotencyStore implements IdempotencyStore {
  readonly #clients: PrismaClientSource<IdempotencyPrismaClient>;

  constructor(clients: PrismaClientSource<IdempotencyPrismaClient>) {
    this.#clients = clients;
  }

  async find(customerId: string, key: string): Promise<IdempotencyRecord | null> {
    const row = await this.#clients
      .current()
      .idempotencyRecord.findUnique({ where: where(customerId, key) });

    if (!row) return null;

    return {
      customerId: row.customerId,
      key: row.key,
      requestHash: row.requestHash,
      status: row.status,
      response: row.response ?? null,
    };
  }

  async reserve(customerId: string, key: string, requestHash: string): Promise<boolean> {
    try {
      await this.#clients.current().idempotencyRecord.create({
        data: { customerId, key, requestHash, status: 'IN_PROGRESS', response: null },
      });
      return true;
    } catch (error) {
      // Chỉ đúng lỗi trùng khoá mới là "thua cuộc". Mọi lỗi khác (mất kết nối,
      // timeout) phải nổi lên: coi chúng là thua sẽ biến sự cố hạ tầng thành
      // một câu trả lời sai lặng lẽ cho khách.
      if (isUniqueViolation(error)) return false;
      throw error;
    }
  }

  async complete(customerId: string, key: string, response: unknown): Promise<void> {
    await this.#clients.current().idempotencyRecord.update({
      where: where(customerId, key),
      data: { status: 'COMPLETED', response },
    });
  }

  async release(customerId: string, key: string): Promise<void> {
    await this.#clients.current().idempotencyRecord.delete({ where: where(customerId, key) });
  }
}

function where(customerId: string, key: string): CompositeKey {
  return { customerId_key: { customerId, key } };
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === UNIQUE_VIOLATION
  );
}
