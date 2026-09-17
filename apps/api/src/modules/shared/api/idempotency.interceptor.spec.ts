import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { firstValueFrom, of } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';

import { IdempotencyService } from '../application/idempotency.service';
import { InMemoryIdempotencyStore } from '../infrastructure/in-memory-idempotency.store';
import { IdempotencyInterceptor } from './idempotency.interceptor';

interface FakeRequest {
  headers: Record<string, string>;
  body: unknown;
  user?: { id: string };
}

function contextFor(request: FakeRequest): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => () => undefined,
    getClass: () => class {},
  } as unknown as ExecutionContext;
}

function handlerReturning(value: unknown, counter: { calls: number }): CallHandler {
  return {
    handle: () => {
      counter.calls += 1;
      return of(value);
    },
  };
}

function setup(marked = true) {
  const store = new InMemoryIdempotencyStore();
  const reflector = {
    getAllAndOverride: () => marked,
  } as unknown as ConstructorParameters<typeof IdempotencyInterceptor>[0];
  const interceptor = new IdempotencyInterceptor(reflector, new IdempotencyService(store));
  return { store, interceptor };
}

const orderRequest: FakeRequest = {
  headers: { 'idempotency-key': 'key-abc' },
  body: { cartId: 'cart_1' },
  user: { id: 'cus_1' },
};

describe('IdempotencyInterceptor - routes that opt out', () => {
  it('should pass an unmarked route straight through', async () => {
    // arrange
    const { interceptor } = setup(false);
    const counter = { calls: 0 };
    const context = contextFor({ headers: {}, body: {}, user: { id: 'cus_1' } });

    // confirm
    expect(counter.calls).toBe(0);

    // act
    const response = await firstValueFrom(
      await interceptor.intercept(context, handlerReturning({ ok: true }, counter)),
    );

    // assert
    expect(counter.calls).toBe(1);
    expect(response).toEqual({ ok: true });
  });
});

describe('IdempotencyInterceptor - marked routes', () => {
  let ctx: ReturnType<typeof setup>;

  beforeEach(() => {
    ctx = setup();
  });

  it('should reject a request that carries no Idempotency-Key', async () => {
    // arrange
    const counter = { calls: 0 };
    const context = contextFor({ headers: {}, body: {}, user: { id: 'cus_1' } });

    // confirm
    expect(counter.calls).toBe(0);

    // act
    const act = async () =>
      ctx.interceptor.intercept(context, handlerReturning({ ok: true }, counter));

    // assert
    await expect(act()).rejects.toThrow(BadRequestException);
    expect(counter.calls).toBe(0);
  });

  it('should run the handler and return its response on the first call', async () => {
    // arrange
    const counter = { calls: 0 };
    const context = contextFor(orderRequest);

    // confirm
    expect(await ctx.store.find('cus_1', 'key-abc')).toBeNull();

    // act
    const response = await firstValueFrom(
      await ctx.interceptor.intercept(context, handlerReturning({ orderId: 'ord_1' }, counter)),
    );

    // assert
    expect(counter.calls).toBe(1);
    expect(response).toEqual({ orderId: 'ord_1' });
  });

  it('should replay the stored response without running the handler again', async () => {
    // arrange
    const counter = { calls: 0 };
    const context = contextFor(orderRequest);
    await firstValueFrom(
      await ctx.interceptor.intercept(context, handlerReturning({ orderId: 'ord_1' }, counter)),
    );

    // confirm
    expect(counter.calls).toBe(1);

    // act
    const response = await firstValueFrom(
      await ctx.interceptor.intercept(context, handlerReturning({ orderId: 'ord_2' }, counter)),
    );

    // assert
    expect(counter.calls).toBe(1);
    expect(response).toEqual({ orderId: 'ord_1' });
  });

  it('should answer with a conflict when the same key carries a different body', async () => {
    // arrange
    const counter = { calls: 0 };
    await firstValueFrom(
      await ctx.interceptor.intercept(
        contextFor(orderRequest),
        handlerReturning({ orderId: 'ord_1' }, counter),
      ),
    );

    // confirm
    expect(counter.calls).toBe(1);

    // act
    const act = async () =>
      ctx.interceptor.intercept(
        contextFor({ ...orderRequest, body: { cartId: 'cart_2' } }),
        handlerReturning({ orderId: 'ord_2' }, counter),
      );

    // assert
    await expect(act()).rejects.toThrow(ConflictException);
    expect(counter.calls).toBe(1);
  });
});
