import { beforeEach, describe, expect, it } from 'vitest';

import {
  IdempotencyPrismaClient,
  IdempotencyRow,
  PrismaIdempotencyStore,
} from './prisma-idempotency.store';

/** Lỗi trùng khoá của Postgres, đúng hình dạng Prisma ném ra (`P2002`). */
class UniqueViolation extends Error {
  readonly code = 'P2002';

  constructor() {
    super('Unique constraint failed on the fields: (`customer_id`,`key`)');
  }
}

/**
 * Kho giả có **một ràng buộc duy nhất thật**: `create` trên khoá đã tồn tại thì
 * ném `P2002`, y như `UNIQUE (customer_id, key)` trong migration. Đó chính là
 * thứ làm `reserve()` nguyên tử, nên nó phải là thứ được mô phỏng.
 */
class FakeIdempotencyClient implements IdempotencyPrismaClient {
  readonly rows = new Map<string, IdempotencyRow>();
  failWith: Error | null = null;

  readonly idempotencyRecord = {
    findUnique: async (args: {
      where: { customerId_key: { customerId: string; key: string } };
    }): Promise<IdempotencyRow | null> => {
      this.#maybeFail();
      return this.rows.get(keyOf(args.where.customerId_key)) ?? null;
    },
    create: async (args: { data: IdempotencyRow }): Promise<unknown> => {
      this.#maybeFail();
      const id = keyOf(args.data);
      if (this.rows.has(id)) throw new UniqueViolation();
      this.rows.set(id, args.data);
      return args.data;
    },
    update: async (args: {
      where: { customerId_key: { customerId: string; key: string } };
      data: { status: 'COMPLETED'; response: unknown };
    }): Promise<unknown> => {
      this.#maybeFail();
      const id = keyOf(args.where.customerId_key);
      const row = this.rows.get(id);
      if (!row) throw new Error('row not found');
      this.rows.set(id, { ...row, ...args.data });
      return this.rows.get(id);
    },
    delete: async (args: {
      where: { customerId_key: { customerId: string; key: string } };
    }): Promise<unknown> => {
      this.#maybeFail();
      this.rows.delete(keyOf(args.where.customerId_key));
      return null;
    },
  };

  #maybeFail(): void {
    if (this.failWith) throw this.failWith;
  }
}

function keyOf(record: { customerId: string; key: string }): string {
  return `${record.customerId}::${record.key}`;
}

function setup() {
  const client = new FakeIdempotencyClient();
  const store = new PrismaIdempotencyStore({ current: () => client });
  return { client, store };
}

describe('PrismaIdempotencyStore - claiming a key', () => {
  let ctx: ReturnType<typeof setup>;

  beforeEach(() => {
    ctx = setup();
  });

  it('should win a free key by inserting the row', async () => {
    // arrange
    const { store, client } = ctx;

    // confirm
    expect(client.rows.size).toBe(0);

    // act
    const won = await store.reserve('cus_1', 'key_1', 'hash_1');

    // assert
    expect(won).toBe(true);
    expect(client.rows.size).toBe(1);
  });

  it('should mark a freshly claimed key as still running', async () => {
    // arrange
    const { store, client } = ctx;

    // confirm
    expect(client.rows.size).toBe(0);

    // act
    await store.reserve('cus_1', 'key_1', 'hash_1');

    // assert
    expect(client.rows.get('cus_1::key_1')?.status).toBe('IN_PROGRESS');
  });

  it('should lose a key that someone else already took', async () => {
    // arrange
    const { store } = ctx;
    await store.reserve('cus_1', 'key_1', 'hash_1');

    // confirm
    expect(ctx.client.rows.size).toBe(1);

    // act
    const won = await store.reserve('cus_1', 'key_1', 'hash_1');

    // assert
    expect(won).toBe(false);
  });

  it('should not overwrite the row it lost the race for', async () => {
    // arrange
    const { store, client } = ctx;
    await store.reserve('cus_1', 'key_1', 'hash_1');
    await store.complete('cus_1', 'key_1', { orderId: 'ord_1' });

    // confirm
    expect(client.rows.get('cus_1::key_1')?.status).toBe('COMPLETED');

    // act
    await store.reserve('cus_1', 'key_1', 'hash_2');

    // assert
    expect(client.rows.get('cus_1::key_1')?.status).toBe('COMPLETED');
    expect(client.rows.get('cus_1::key_1')?.requestHash).toBe('hash_1');
  });

  it('should let the same key through for a different customer', async () => {
    // arrange
    const { store } = ctx;
    await store.reserve('cus_1', 'key_1', 'hash_1');

    // confirm
    expect(ctx.client.rows.size).toBe(1);

    // act
    const won = await store.reserve('cus_2', 'key_1', 'hash_1');

    // assert
    expect(won).toBe(true);
  });

  it('should let an infrastructure failure surface instead of reporting a lost key', async () => {
    // arrange
    const { store, client } = ctx;
    client.failWith = new Error('connection lost');

    // confirm
    expect(client.rows.size).toBe(0);

    // act
    const act = store.reserve('cus_1', 'key_1', 'hash_1');

    // assert
    await expect(act).rejects.toThrow('connection lost');
  });
});

describe('PrismaIdempotencyStore - finishing the work', () => {
  let ctx: ReturnType<typeof setup>;

  beforeEach(() => {
    ctx = setup();
  });

  it('should find nothing for a key nobody claimed', async () => {
    // arrange
    const { store, client } = ctx;

    // confirm
    expect(client.rows.size).toBe(0);

    // act
    const found = await store.find('cus_1', 'key_1');

    // assert
    expect(found).toBeNull();
  });

  it('should hand back the record it stored', async () => {
    // arrange
    const { store } = ctx;
    await store.reserve('cus_1', 'key_1', 'hash_1');

    // confirm
    expect(ctx.client.rows.size).toBe(1);

    // act
    const found = await store.find('cus_1', 'key_1');

    // assert
    expect(found).toEqual({
      customerId: 'cus_1',
      key: 'key_1',
      requestHash: 'hash_1',
      status: 'IN_PROGRESS',
      response: null,
    });
  });

  it('should keep the response so a retry gets the first answer back', async () => {
    // arrange
    const { store } = ctx;
    await store.reserve('cus_1', 'key_1', 'hash_1');

    // confirm
    expect((await store.find('cus_1', 'key_1'))?.status).toBe('IN_PROGRESS');

    // act
    await store.complete('cus_1', 'key_1', { orderId: 'ord_1' });

    // assert
    const found = await store.find('cus_1', 'key_1');
    expect(found?.status).toBe('COMPLETED');
    expect(found?.response).toEqual({ orderId: 'ord_1' });
  });

  it('should let go of the key when the work failed', async () => {
    // arrange
    const { store, client } = ctx;
    await store.reserve('cus_1', 'key_1', 'hash_1');

    // confirm
    expect(client.rows.size).toBe(1);

    // act
    await store.release('cus_1', 'key_1');

    // assert
    expect(await store.find('cus_1', 'key_1')).toBeNull();
  });

  it('should let the client retry after the key was released', async () => {
    // arrange
    const { store } = ctx;
    await store.reserve('cus_1', 'key_1', 'hash_1');
    await store.release('cus_1', 'key_1');

    // confirm
    expect(await store.find('cus_1', 'key_1')).toBeNull();

    // act
    const won = await store.reserve('cus_1', 'key_1', 'hash_1');

    // assert
    expect(won).toBe(true);
  });
});
