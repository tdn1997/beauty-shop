import { describe, expect, it, vi } from 'vitest';
import { CheckoutService } from './checkout.service';
import { Address } from '../domain/address';
import { Result } from '../../shared/domain/result';
import { Money } from '../../shared/domain/money';
import { Quote } from '../../pricing/domain/quote';
import { QuoteLine } from '../../pricing/domain/quote-line';
import { PaymentGatewayRegistry } from '../../payment/application/payment-gateway.registry';
import { DomainError } from '../../shared/domain/domain-error';
import { PaymentInitiation } from '../../payment/application/payment-gateway';
import { PaymentStatus } from '../../payment/domain/payment-status';

const request = { addressId: 'address', currency: 'VND' as const, lines: [{ variantId: 'variant', quantity: 2 }] };
const principal = { customerId: 'customer' };

function fixture() {
  const state = { orders: [] as unknown[], events: [] as unknown[], reservations: 0, record: null as any };
  let inTransaction = false;
  const address = Address.create({ recipientName: 'Name', phone: '0901234567', line1: 'Street', ward: 'Ward', district: 'District', province: 'Province' });
  const quote = Quote.for({ customerId: 'customer', currency: 'VND', province: 'Province', lines: [QuoteLine.create({ variantId: 'variant', sku: 'SKU', nameSnapshot: 'Product', unitPrice: Money.parse('100000', 'VND'), quantity: 2 })], discount: Money.parse('10000', 'VND'), shippingFee: Money.parse('20000', 'VND') });
  const initiate = vi.fn(async (_request: PaymentInitiation) => {
    expect(inTransaction).toBe(false);
    expect(state.orders).toHaveLength(1);
    expect(state.events).toHaveLength(1);
    expect(state.record.response.payment.status).toBe(PaymentStatus.Unknown);
    return Result.ok({ status: PaymentStatus.Paid, providerRef: 'ref', redirectUrl: null, reason: null });
  });
  const dependencies = {
    addresses: { findOwned: vi.fn(async () => address) },
    quotes: { quoteFor: vi.fn(async () => Result.ok(quote)) },
    inventory: { reserveForVariant: vi.fn(async () => { state.reservations += 2; return Result.ok(undefined); }) },
    orders: { save: vi.fn(async (order: any) => { state.orders.push(order.toSnapshot()); return Result.ok(undefined); }) },
    outbox: { append: vi.fn(async (event: any) => { state.events.push(event.toSnapshot()); return Result.ok(undefined); }) },
    replay: {
      find: vi.fn(async () => state.record),
      reserve: vi.fn(async (customerId: string, key: string, requestHash: string) => { state.record = { customerId, key, requestHash, status: 'IN_PROGRESS', response: null }; return true; }),
      complete: vi.fn(async (_customer: string, _key: string, response: unknown) => { state.record = { ...state.record, status: 'COMPLETED', response: JSON.parse(JSON.stringify(response)) }; }),
    },
    transactions: { run: async <T>(work: () => Promise<T>): Promise<T> => {
      const before = structuredClone(state);
      inTransaction = true;
      try { return await work(); }
      catch (error) { Object.assign(state, before); throw error; }
      finally { inTransaction = false; }
    } },
    gateways: new PaymentGatewayRegistry([{ provider: 'mock', initiate, query: vi.fn() }], 'mock'),
    clock: { now: () => new Date('2026-09-17T00:00:00Z') },
    nextId: () => 'order-1',
    returnUrl: 'https://shop.example/payment',
  };
  return { state, dependencies, initiate, checkout: new CheckoutService(dependencies) };
}

describe('CheckoutService', () => {
  it.each(['inventory', 'orders'] as const)('should rollback all writes when %s returns Result.err', async (port) => {
    // arrange
    const { checkout, state, dependencies, initiate } = fixture();
    const failure = Result.err<undefined>(new DomainError('OUT_OF_STOCK', 'unavailable'));
    if (port === 'inventory') dependencies.inventory.reserveForVariant.mockResolvedValueOnce(failure);
    else dependencies.orders.save.mockResolvedValueOnce(failure);
    const before = structuredClone(state);
    // confirm
    expect(state.record).toBeNull();
    // act
    const result = await checkout.placeOrder(principal, 'key', request);
    // assert
    expect(result.errorOrNull()?.code).toBe('OUT_OF_STOCK');
    expect(state).toEqual(before);
    expect(initiate).not.toHaveBeenCalled();
  });
  it('should rollback all writes if the initial durable response cannot be saved', async () => {
    // arrange
    const { checkout, state, dependencies, initiate } = fixture();
    dependencies.replay.complete.mockRejectedValueOnce(new Error('storage unavailable'));
    const before = structuredClone(state);
    // confirm
    expect(state.record).toBeNull();
    // act
    const result = checkout.placeOrder(principal, 'key', request);
    // assert
    await expect(result).rejects.toThrow('storage unavailable');
    expect(state).toEqual(before);
    expect(initiate).not.toHaveBeenCalled();
  });

  it('should replay UNKNOWN after a postcommit payment exception without reserving or charging again', async () => {
    // arrange
    const { checkout, state, initiate } = fixture();
    initiate.mockRejectedValueOnce(new Error('socket closed'));
    // confirm
    expect(state.orders).toEqual([]);
    // act
    const result = checkout.placeOrder(principal, 'key', request);
    // assert
    await expect(result).rejects.toThrow('socket closed');
    const committed = structuredClone(state);
    const retry = await checkout.placeOrder(principal, 'key', request);
    expect(retry.unwrap().payment.status).toBe(PaymentStatus.Unknown);
    expect(state).toEqual(committed);
    expect(initiate).toHaveBeenCalledTimes(1);
  });

  it('should preserve committed replay when saving the payment response fails', async () => {
    // arrange
    const { checkout, state, dependencies, initiate } = fixture();
    const complete = dependencies.replay.complete.getMockImplementation()!;
    dependencies.replay.complete.mockImplementation(async (customer, key, response) => {
      if (state.orders.length && state.record.status === 'COMPLETED') throw new Error('response save failed');
      await complete(customer, key, response);
    });
    // confirm
    expect(state.record).toBeNull();
    // act
    const result = checkout.placeOrder(principal, 'key', request);
    // assert
    await expect(result).rejects.toThrow('response save failed');
    const committed = structuredClone(state);
    const retry = await checkout.placeOrder(principal, 'key', request);
    expect(retry.unwrap().payment.status).toBe(PaymentStatus.Unknown);
    expect(state).toEqual(committed);
    expect(initiate).toHaveBeenCalledTimes(1);
  });

  it('should rollback reservations order and replay when append returns Result.err', async () => {
    // arrange
    const { checkout, state, dependencies, initiate } = fixture();
    dependencies.outbox.append.mockResolvedValueOnce(Result.err(new DomainError('CONCURRENT_MODIFICATION', 'conflict')));
    const before = structuredClone(state);
    // confirm
    expect(state.record).toBeNull();
    // act
    const result = await checkout.placeOrder(principal, 'key', request);
    // assert
    expect(result.errorOrNull()?.code).toBe('CONCURRENT_MODIFICATION');
    expect(state).toEqual(before);
    expect(initiate).not.toHaveBeenCalled();
  });

  it('should check address ownership before returning a committed replay', async () => {
    const { checkout, state, dependencies } = fixture();
    await checkout.placeOrder(principal, 'key', request);
    dependencies.addresses.findOwned.mockResolvedValueOnce(null as never);
    dependencies.replay.find.mockClear();
    const before = structuredClone(state);
    // confirm
    expect(state.orders).toHaveLength(1);
    // act
    const result = await checkout.placeOrder(principal, 'key', request);
    // assert
    expect(result.errorOrNull()?.code).toBe('ADDRESS_NOT_OWNED');
    expect(dependencies.replay.find).not.toHaveBeenCalled();
    expect(state).toEqual(before);
  });

  it('should reject the same key with a changed body without changing committed state', async () => {
    // arrange
    const { checkout, state, initiate } = fixture();
    await checkout.placeOrder(principal, 'key', request);
    const before = structuredClone(state);
    // confirm
    expect(state.orders).toHaveLength(1);
    // act
    const result = await checkout.placeOrder(principal, 'key', { ...request, lines: [{ variantId: 'variant', quantity: 3 }] });
    // assert
    expect(result.errorOrNull()?.code).toBe('IDEMPOTENCY_KEY_REUSED');
    expect(state).toEqual(before);
    expect(initiate).toHaveBeenCalledTimes(1);
  });

  it('should reject a missing trusted principal without changing state', async () => {
    const { state, checkout } = fixture();
    const before = structuredClone(state);
    // confirm
    expect(state.orders).toEqual([]);
    // act
    const result = await checkout.placeOrder(null, 'key', request);
    // assert
    expect(result.errorOrNull()?.code).toBe('UNAUTHENTICATED');
    expect(state).toEqual(before);
  });

  it('should commit a server priced confirmed order and durable replay before payment', async () => {
    const { state, checkout, initiate, dependencies } = fixture();
    // confirm
    expect(state.orders).toEqual([]);
    // act
    const result = await checkout.placeOrder(principal, 'key', request);
    // assert
    expect(result.isOk()).toBe(true);
    expect(state.orders).toMatchObject([{ customerId: 'customer', status: 'CONFIRMED', discountMinorUnits: 10000n, shippingFeeMinorUnits: 20000n }]);
    expect(dependencies.inventory.reserveForVariant).toHaveBeenCalledWith('variant', 2);
    expect(initiate.mock.calls[0]?.[0]).toMatchObject({ orderId: 'order-1' });
    expect(initiate.mock.calls[0]?.[0].amount.equals(Money.parse('210000', 'VND'))).toBe(true);
    expect(state.record.response.payment.status).toBe(PaymentStatus.Paid);
    expect(JSON.parse(JSON.stringify(state.record.response))).toEqual(result.unwrap());
  });
});
