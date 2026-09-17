import { beforeEach, describe, expect, it } from 'vitest';

import { InMemoryIdempotencyStore } from '../infrastructure/in-memory-idempotency.store';
import { IdempotencyService } from './idempotency.service';

const request = {
  customerId: 'cus_1',
  key: 'key-abc',
  body: { cartId: 'cart_1', lines: [{ sku: 'SRM-VTC-30', quantity: 2 }] },
};

function setup() {
  const store = new InMemoryIdempotencyStore();
  const service = new IdempotencyService(store);
  return { store, service };
}

describe('IdempotencyService - first request', () => {
  let ctx: ReturnType<typeof setup>;

  beforeEach(() => {
    ctx = setup();
  });

  it('should run the handler and return its response', async () => {
    // arrange
    const { service } = ctx;
    let calls = 0;

    // confirm
    expect(calls).toBe(0);

    // act
    const result = await service.run(request, async () => {
      calls += 1;
      return { orderId: 'ord_1' };
    });

    // assert
    expect(calls).toBe(1);
    expect(result.unwrap()).toEqual({ orderId: 'ord_1' });
  });
});

describe('IdempotencyService - replay', () => {
  let ctx: ReturnType<typeof setup>;

  beforeEach(() => {
    ctx = setup();
  });

  it('should replay the stored response without running the handler again', async () => {
    // arrange
    const { service } = ctx;
    let calls = 0;
    const handler = async () => {
      calls += 1;
      return { orderId: `ord_${calls}` };
    };
    await service.run(request, handler);

    // confirm
    expect(calls).toBe(1);

    // act
    const result = await service.run(request, handler);

    // assert
    expect(calls).toBe(1);
    expect(result.unwrap()).toEqual({ orderId: 'ord_1' });
  });

  it('should ignore key ordering when hashing the body', async () => {
    // arrange
    const { service } = ctx;
    let calls = 0;
    const handler = async () => {
      calls += 1;
      return { orderId: 'ord_1' };
    };
    await service.run({ ...request, body: { a: 1, b: 2 } }, handler);

    // confirm
    expect(calls).toBe(1);

    // act
    const result = await service.run({ ...request, body: { b: 2, a: 1 } }, handler);

    // assert
    expect(calls).toBe(1);
    expect(result.isOk()).toBe(true);
  });

  it('should refuse to reuse a key for a different body', async () => {
    // arrange
    const { service } = ctx;
    let calls = 0;
    const handler = async () => {
      calls += 1;
      return { orderId: 'ord_1' };
    };
    await service.run(request, handler);

    // confirm
    expect(calls).toBe(1);

    // act
    const result = await service.run(
      { ...request, body: { cartId: 'cart_2', lines: [] } },
      handler,
    );

    // assert
    expect(result.errorOrNull()?.code).toBe('IDEMPOTENCY_KEY_REUSED');
    expect(calls).toBe(1);
  });

  it('should scope keys per customer', async () => {
    // arrange
    const { service } = ctx;
    let calls = 0;
    const handler = async () => {
      calls += 1;
      return { orderId: `ord_${calls}` };
    };
    await service.run(request, handler);

    // confirm
    expect(calls).toBe(1);

    // act
    const result = await service.run({ ...request, customerId: 'cus_2' }, handler);

    // assert
    expect(calls).toBe(2);
    expect(result.unwrap()).toEqual({ orderId: 'ord_2' });
  });
});

describe('IdempotencyService - concurrency and failure', () => {
  let ctx: ReturnType<typeof setup>;

  beforeEach(() => {
    ctx = setup();
  });

  it('should reject a second request while the first is still running', async () => {
    // arrange
    const { service } = ctx;
    let release = (): void => {};
    const blocked = new Promise<void>((resolve) => {
      release = resolve;
    });
    const first = service.run(request, async () => {
      await blocked;
      return { orderId: 'ord_1' };
    });

    // confirm
    expect(typeof release).toBe('function');

    // act
    const second = await service.run(request, async () => ({ orderId: 'ord_2' }));

    // assert
    expect(second.errorOrNull()?.code).toBe('IDEMPOTENCY_IN_PROGRESS');
    release();
    expect((await first).unwrap()).toEqual({ orderId: 'ord_1' });
  });

  it('should free the key when the handler reports a business failure', async () => {
    // arrange
    const { service } = ctx;
    let calls = 0;

    // confirm
    expect(calls).toBe(0);

    // act
    await service.run(request, async () => {
      calls += 1;
      throw new Error('hết hàng');
    }).catch(() => undefined);
    const retry = await service.run(request, async () => {
      calls += 1;
      return { orderId: 'ord_1' };
    });

    // assert
    expect(calls).toBe(2);
    expect(retry.unwrap()).toEqual({ orderId: 'ord_1' });
  });

  it('should not store a response when the handler fails', async () => {
    // arrange
    const { service, store } = ctx;

    // confirm
    expect(await store.find('cus_1', 'key-abc')).toBeNull();

    // act
    await service
      .run(request, async () => {
        throw new Error('hết hàng');
      })
      .catch(() => undefined);

    // assert
    expect(await store.find('cus_1', 'key-abc')).toBeNull();
  });
});
