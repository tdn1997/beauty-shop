import { beforeEach, describe, expect, it } from 'vitest';

import { Money } from '../../shared/domain/money';
import { Address } from '../domain/address';
import { Order, OrderStatus } from '../domain/order';
import {
  OrderLineWriteRow,
  OrderPrismaClient,
  PrismaOrderRepository,
  SalesOrderRow,
  SalesOrderWriteRow,
} from './prisma-order.repository';

it('should persist quoted adjustments and derive the same grand total after reload', async () => {
  const client = new FakeOrderClient();
  const repository = new PrismaOrderRepository({ current: () => client });
  const order = Order.draft({ id: 'adjusted', customerId: 'customer', currency: 'VND' });
  order.addQuotedLine(serum);
  order.applyQuotedAdjustments(Money.parse('10000', 'VND'), Money.parse('20000', 'VND'));
  expect(await repository.findById(order.id)).toBeNull();
  await repository.save(order);
  const loaded = await repository.findById(order.id);
  expect(loaded!.grandTotal().equals(order.grandTotal())).toBe(true);
  expect(loaded!.toSnapshot()).toEqual(order.toSnapshot());
});

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
  unitPriceSnapshot: Money.parse('459000', 'VND'),
  quantity: 2,
};

const mask = {
  variantId: 'var_2',
  sku: 'MSK-CLY-100',
  nameSnapshot: 'Mặt nạ đất sét 100g',
  unitPriceSnapshot: Money.parse('180000', 'VND'),
  quantity: 1,
};

class FakeOrderClient implements OrderPrismaClient {
  readonly rows = new Map<string, SalesOrderWriteRow>();
  readonly lines = new Map<string, OrderLineWriteRow[]>();
  failWith: Error | null = null;

  readonly salesOrder = {
    findUnique: async (args: {
      where: { id: string };
      include?: { lines?: boolean };
    }): Promise<SalesOrderRow | null> => {
      this.#maybeFail();
      const row = this.rows.get(args.where.id);
      if (!row) return null;
      return { ...row, lines: this.lines.get(args.where.id) ?? [] };
    },
    create: async (args: {
      data: SalesOrderWriteRow & { lines: { create: Omit<OrderLineWriteRow, 'orderId'>[] } };
    }): Promise<unknown> => {
      this.#maybeFail();
      const { lines, ...row } = args.data;
      this.rows.set(row.id, row);
      this.lines.set(
        row.id,
        lines.create.map((line) => ({ ...line, orderId: row.id })),
      );
      return row;
    },
    updateMany: async (args: {
      where: { id: string; version: number };
      data: SalesOrderWriteRow;
    }): Promise<{ count: number }> => {
      this.#maybeFail();
      const row = this.rows.get(args.where.id);
      if (!row || row.version !== args.where.version) return { count: 0 };
      this.rows.set(args.where.id, args.data);
      return { count: 1 };
    },
    findMany: async (args: {
      skip: number;
      take: number;
      orderBy: readonly [{ createdAt: 'desc' }, { id: 'asc' }];
      include: { lines: true };
    }): Promise<SalesOrderRow[]> => {
      this.#maybeFail();
      const allRows = [...this.rows.values()].sort((a, b) => a.id.localeCompare(b.id));
      return allRows
        .slice(args.skip, args.skip + args.take)
        .map((row) => ({ ...row, lines: this.lines.get(row.id) ?? [] }));
    },
    count: async (): Promise<number> => {
      this.#maybeFail();
      return this.rows.size;
    },
  };

  readonly orderLine = {
    deleteMany: async (args: { where: { orderId: string } }): Promise<{ count: number }> => {
      this.#maybeFail();
      const removed = this.lines.get(args.where.orderId)?.length ?? 0;
      this.lines.set(args.where.orderId, []);
      return { count: removed };
    },
    createMany: async (args: {
      data: readonly OrderLineWriteRow[];
    }): Promise<{ count: number }> => {
      this.#maybeFail();
      for (const line of args.data) {
        this.lines.set(line.orderId, [...(this.lines.get(line.orderId) ?? []), line]);
      }
      return { count: args.data.length };
    },
  };

  #maybeFail(): void {
    if (this.failWith) throw this.failWith;
  }
}

function setup() {
  const client = new FakeOrderClient();
  const repository = new PrismaOrderRepository({ current: () => client });
  return { client, repository };
}

function confirmedOrder(): Order {
  const order = Order.draft({ id: 'ord_1', customerId: 'cus_1', currency: 'VND' });
  order.addQuotedLine(serum);
  order.shipTo(Address.create(addressProps));
  order.confirm();
  return order;
}

describe('PrismaOrderRepository - reading', () => {
  let ctx: ReturnType<typeof setup>;

  beforeEach(() => {
    ctx = setup();
  });

  it('should return null when no row matches', async () => {
    const { repository, client } = ctx;
    expect(client.rows.size).toBe(0);
    const found = await repository.findById('ord_missing');
    expect(found).toBeNull();
  });

  it('should rebuild the aggregate rather than hand back the stored row', async () => {
    const { repository } = ctx;
    await repository.save(confirmedOrder());
    expect(ctx.client.rows.size).toBe(1);
    const found = await repository.findById('ord_1');
    expect(found).toBeInstanceOf(Order);
    expect(found?.status).toBe(OrderStatus.Confirmed);
    expect(found?.shippingAddress?.toJSON().recipientName).toBe('Nguyễn Văn A');
  });

  it('should read back exactly the order it wrote', async () => {
    const { repository } = ctx;
    const order = confirmedOrder();
    await repository.save(order);
    expect(order.lines).toHaveLength(1);
    const found = await repository.findById('ord_1');
    expect(found?.toSnapshot()).toEqual(order.toSnapshot());
  });

  it('should treat the stored version as already persisted', async () => {
    const { repository } = ctx;
    const order = confirmedOrder();
    await repository.save(order);
    expect(order.version).toBeGreaterThan(0);
    const found = await repository.findById('ord_1');
    expect(found?.persistedVersion).toBe(order.version);
  });
});

describe('PrismaOrderRepository - writing', () => {
  let ctx: ReturnType<typeof setup>;

  beforeEach(() => {
    ctx = setup();
  });

  it('should insert an order that was never stored before', async () => {
    const { repository, client } = ctx;
    const order = confirmedOrder();
    expect(order.persistedVersion).toBeNull();
    const result = await repository.save(order);
    expect(result.isOk()).toBe(true);
    expect(client.rows.get('ord_1')?.version).toBe(order.version);
  });

  it('should mark the order persisted after a successful write', async () => {
    const { repository } = ctx;
    const order = confirmedOrder();
    expect(order.persistedVersion).toBeNull();
    await repository.save(order);
    expect(order.persistedVersion).toBe(order.version);
  });

  it('should store money as minor units rather than a decimal', async () => {
    const { repository, client } = ctx;
    expect(serum.unitPriceSnapshot.toString()).toBe('459000 VND');
    await repository.save(confirmedOrder());
    expect(client.lines.get('ord_1')?.[0]?.unitPrice).toBe(459000n);
  });

  it('should replace the stored lines instead of piling new ones on top', async () => {
    const { repository, client } = ctx;
    const order = Order.draft({ id: 'ord_1', customerId: 'cus_1', currency: 'VND' });
    order.addQuotedLine(serum);
    order.addQuotedLine(mask);
    await repository.save(order);
    expect(client.lines.get('ord_1')).toHaveLength(2);
    order.removeLine('var_2');
    await repository.save(order);
    expect(client.lines.get('ord_1')).toHaveLength(1);
    expect(client.lines.get('ord_1')?.[0]?.variantId).toBe('var_1');
  });

  it('should let an infrastructure failure surface instead of turning it into a result', async () => {
    const { repository, client } = ctx;
    client.failWith = new Error('connection lost');
    expect(client.rows.size).toBe(0);
    const act = repository.save(confirmedOrder());
    await expect(act).rejects.toThrow('connection lost');
  });
});

describe('PrismaOrderRepository - optimistic locking', () => {
  let ctx: ReturnType<typeof setup>;

  beforeEach(() => {
    ctx = setup();
  });

  it('should guard the update with the version it read', async () => {
    const { repository } = ctx;
    await repository.save(confirmedOrder());
    const reloaded = (await repository.findById('ord_1')) as Order;
    reloaded.markPaid();
    expect(reloaded.version).toBe((reloaded.persistedVersion as number) + 1);
    const result = await repository.save(reloaded);
    expect(result.isOk()).toBe(true);
    expect(ctx.client.rows.get('ord_1')?.status).toBe(OrderStatus.Paid);
  });

  it('should refuse to overwrite an order that changed underneath it', async () => {
    const { repository, client } = ctx;
    await repository.save(confirmedOrder());
    const mine = (await repository.findById('ord_1')) as Order;
    const theirs = (await repository.findById('ord_1')) as Order;
    theirs.markPaid();
    await repository.save(theirs);
    expect(client.rows.get('ord_1')?.status).toBe(OrderStatus.Paid);
    mine.cancel('Khách đổi ý');
    const result = await repository.save(mine);
    expect(result.isErr()).toBe(true);
    expect(result.errorOrNull()?.code).toBe('CONCURRENT_MODIFICATION');
  });

  it('should leave the stored row untouched when it loses the race', async () => {
    const { repository, client } = ctx;
    await repository.save(confirmedOrder());
    const mine = (await repository.findById('ord_1')) as Order;
    const theirs = (await repository.findById('ord_1')) as Order;
    theirs.markPaid();
    await repository.save(theirs);
    const before = { ...client.rows.get('ord_1') } as SalesOrderWriteRow;
    expect(before.status).toBe(OrderStatus.Paid);
    mine.cancel('Khách đổi ý');
    await repository.save(mine);
    expect(client.rows.get('ord_1')).toEqual(before);
    expect(client.lines.get('ord_1')).toHaveLength(1);
  });

  it('should keep the order unpersisted after a lost race so a retry can re-read', async () => {
    const { repository } = ctx;
    await repository.save(confirmedOrder());
    const mine = (await repository.findById('ord_1')) as Order;
    const theirs = (await repository.findById('ord_1')) as Order;
    theirs.markPaid();
    await repository.save(theirs);
    expect(mine.persistedVersion).toBe(mine.version);
    mine.cancel('Khách đổi ý');
    await repository.save(mine);
    expect(mine.persistedVersion).not.toBe(mine.version);
  });
});
