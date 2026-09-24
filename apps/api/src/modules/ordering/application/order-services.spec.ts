import { beforeEach, describe, expect, it } from 'vitest';

import { DomainError } from '../../shared/domain/domain-error';
import { Money } from '../../shared/domain/money';
import { Result } from '../../shared/domain/result';
import { Order, OrderStatus } from '../domain/order';
import { InMemoryOrderRepository } from '../infrastructure/in-memory-order.repository';
import { OrderCommandService } from './order-command.service';
import { OrderQueryService } from './order-query.service';
import { OrderRepository } from './order-repository';

const addressProps = {
  recipientName: 'Nguyễn Văn A',
  phone: '0901234567',
  line1: '12 Lý Thường Kiệt',
  ward: 'Phường 7',
  district: 'Quận 10',
  province: 'TP. Hồ Chí Minh',
};

const serum = {
  variantId: 'var_1',
  sku: 'SRM-VTC-30',
  nameSnapshot: 'Serum Vitamin C 30ml',
  unitPrice: '459000',
  quantity: 2,
};

class SaveAlwaysFails implements OrderRepository {
  readonly #inner: OrderRepository;

  constructor(inner: OrderRepository) {
    this.#inner = inner;
  }

  async findById(id: string): Promise<Order | null> {
    return this.#inner.findById(id);
  }

  async list(page: number, limit: number) {
    return this.#inner.list(page, limit);
  }

  async save(): Promise<Result<void>> {
    throw new Error('connection lost');
  }
}

function setup() {
  const repository = new InMemoryOrderRepository();
  const commands = new OrderCommandService(repository);
  const queries = new OrderQueryService(repository);
  return { repository, commands, queries };
}

async function draftWithLineAndAddress(commands: OrderCommandService) {
  await commands.createDraft({ orderId: 'ord_1', customerId: 'cus_1', currency: 'VND' });
  await commands.addLine({ orderId: 'ord_1', ...serum });
  await commands.setShippingAddress({ orderId: 'ord_1', address: addressProps });
}

describe('OrderCommandService - state changes', () => {
  let ctx: ReturnType<typeof setup>;

  beforeEach(() => {
    ctx = setup();
  });

  it('should create a draft order that the query side can read back', async () => {
    const { commands, queries } = ctx;
    expect(await queries.findById('ord_1')).toBeNull();
    const result = await commands.createDraft({
      orderId: 'ord_1',
      customerId: 'cus_1',
      currency: 'VND',
    });
    expect(result.isOk()).toBe(true);
    expect((await queries.findById('ord_1'))?.status).toBe(OrderStatus.Draft);
  });

  it('should confirm an order that has lines and an address', async () => {
    const { commands, queries } = ctx;
    await draftWithLineAndAddress(commands);
    expect((await queries.findById('ord_1'))?.status).toBe(OrderStatus.Draft);
    const result = await commands.confirm({ orderId: 'ord_1' });
    expect(result.isOk()).toBe(true);
    expect((await queries.findById('ord_1'))?.status).toBe(OrderStatus.Confirmed);
  });
});

describe('OrderCommandService - expected failures come back as Result', () => {
  let ctx: ReturnType<typeof setup>;

  beforeEach(() => {
    ctx = setup();
  });

  it('should return a failure instead of throwing when the order does not exist', async () => {
    const { commands } = ctx;
    expect(await ctx.queries.findById('ord_missing')).toBeNull();
    const result = await commands.confirm({ orderId: 'ord_missing' });
    expect(result.isErr()).toBe(true);
    expect(result.errorOrNull()?.code).toBe('ORDER_NOT_FOUND');
  });

  it('should return a failure when confirming an order with no lines', async () => {
    const { commands } = ctx;
    await commands.createDraft({ orderId: 'ord_1', customerId: 'cus_1', currency: 'VND' });
    await commands.setShippingAddress({ orderId: 'ord_1', address: addressProps });
    expect((await ctx.queries.findById('ord_1'))?.lines).toEqual([]);
    const result = await commands.confirm({ orderId: 'ord_1' });
    expect(result.isErr()).toBe(true);
    expect(result.errorOrNull()?.code).toBe('EMPTY_ORDER');
  });

  it('should return a failure when the transition is not allowed', async () => {
    const { commands } = ctx;
    await draftWithLineAndAddress(commands);
    await commands.confirm({ orderId: 'ord_1' });
    expect((await ctx.queries.findById('ord_1'))?.status).toBe(OrderStatus.Confirmed);
    const result = await commands.confirm({ orderId: 'ord_1' });
    expect(result.isErr()).toBe(true);
    expect(result.errorOrNull()?.code).toBe('INVALID_TRANSITION');
  });

  it('should leave the order untouched when a command fails', async () => {
    const { commands, queries } = ctx;
    await draftWithLineAndAddress(commands);
    const before = await queries.findById('ord_1');
    expect(before?.version).toBeGreaterThan(0);
    const result = await commands.addLine({
      orderId: 'ord_1',
      ...serum,
      unitPrice: '399000',
    });
    expect(result.errorOrNull()?.code).toBe('PRICE_CHANGED');
    expect((await queries.findById('ord_1'))?.version).toBe(before?.version);
  });

  it('should let an infrastructure failure propagate instead of swallowing it', async () => {
    const { repository, commands } = ctx;
    await draftWithLineAndAddress(commands);
    const flaky = new OrderCommandService(new SaveAlwaysFails(repository));
    expect((await ctx.queries.findById('ord_1'))?.status).toBe(OrderStatus.Draft);
    const act = async () => flaky.confirm({ orderId: 'ord_1' });
    await expect(act()).rejects.toThrow('connection lost');
  });
});

describe('OrderQueryService - read side', () => {
  let ctx: ReturnType<typeof setup>;

  beforeEach(() => {
    ctx = setup();
  });

  it('should return a plain DTO rather than the aggregate', async () => {
    const { commands, queries } = ctx;
    await draftWithLineAndAddress(commands);
    expect((await queries.findById('ord_1'))?.id).toBe('ord_1');
    const dto = await queries.findById('ord_1');
    expect(dto).toEqual({
      id: 'ord_1',
      customerId: 'cus_1',
      status: OrderStatus.Draft,
      version: 2,
      currency: 'VND',
      itemsTotal: { amount: '918000', currency: 'VND' },
      discountTotal: { amount: '0', currency: 'VND' },
      shippingFee: { amount: '0', currency: 'VND' },
      grandTotal: { amount: '918000', currency: 'VND' },
      shippingAddress: { ...addressProps, line2: null },
      cancellationReason: null,
      lines: [
        {
          variantId: 'var_1',
          sku: 'SRM-VTC-30',
          name: 'Serum Vitamin C 30ml',
          unitPrice: { amount: '459000', currency: 'VND' },
          quantity: 2,
          subtotal: { amount: '918000', currency: 'VND' },
        },
      ],
    });
  });

  it('should expose the quoted discount, shipping fee and grand total the client renders', async () => {
    // arrange
    const { repository, queries } = ctx;
    const order = Order.draft({ id: 'ord_q', customerId: 'cus_1', currency: 'VND' });
    order.addQuotedLine({
      ...serum,
      unitPriceSnapshot: Money.parse(serum.unitPrice, 'VND'),
    });
    order.applyQuotedAdjustments(Money.parse('91800', 'VND'), Money.parse('30000', 'VND'));
    (await repository.save(order)).unwrap();
    // act
    const dto = await queries.findById('ord_q');
    // assert
    expect(dto).toMatchObject({
      itemsTotal: { amount: '918000', currency: 'VND' },
      discountTotal: { amount: '91800', currency: 'VND' },
      shippingFee: { amount: '30000', currency: 'VND' },
      grandTotal: { amount: '856200', currency: 'VND' },
    });
  });

  it('should hand out a DTO that cannot be used to change the order', async () => {
    const { commands, queries } = ctx;
    await draftWithLineAndAddress(commands);
    const dto = await queries.findById('ord_1');
    expect(dto?.lines).toHaveLength(1);
    const methods = Object.values(dto ?? {}).filter((value) => typeof value === 'function');
    expect(methods).toEqual([]);
    expect(Object.getPrototypeOf(dto)).toBe(Object.prototype);
  });

  it('should expose only read operations', () => {
    const { queries } = ctx;
    expect(queries).toBeInstanceOf(OrderQueryService);
    const methods = Object.getOwnPropertyNames(OrderQueryService.prototype).filter(
      (name) => name !== 'constructor',
    );
    expect(methods.length).toBeGreaterThan(0);
    expect(methods.every((name) => /^(find|get|list|count)/.test(name))).toBe(true);
  });

  it('should return null for an unknown order rather than throwing', async () => {
    const { queries } = ctx;
    expect(queries).toBeInstanceOf(OrderQueryService);
    const dto = await queries.findById('ord_missing');
    expect(dto).toBeNull();
  });
});

class SaveAlwaysConflicts implements OrderRepository {
  readonly #inner: OrderRepository;

  constructor(inner: OrderRepository) {
    this.#inner = inner;
  }

  async findById(id: string): Promise<Order | null> {
    return this.#inner.findById(id);
  }

  async list(page: number, limit: number) {
    return this.#inner.list(page, limit);
  }

  async save(): Promise<Result<void>> {
    return Result.err(
      new DomainError('CONCURRENT_MODIFICATION', 'Đơn đã bị người khác sửa', {
        orderId: 'ord_1',
      }),
    );
  }
}

describe('OrderCommandService - concurrency', () => {
  let ctx: ReturnType<typeof setup>;

  beforeEach(() => {
    ctx = setup();
  });

  it('should report a lost lock race as an expected business result', async () => {
    const { repository, commands, queries } = ctx;
    await draftWithLineAndAddress(commands);
    const contended = new OrderCommandService(new SaveAlwaysConflicts(repository));
    expect((await queries.findById('ord_1'))?.status).toBe(OrderStatus.Draft);
    const result = await contended.confirm({ orderId: 'ord_1' });
    expect(result.isErr()).toBe(true);
    expect(result.errorOrNull()?.code).toBe('CONCURRENT_MODIFICATION');
  });
});
