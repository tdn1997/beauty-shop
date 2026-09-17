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

/**
 * Kho giả đứng thay Postgres.
 *
 * Nó **tôn trọng vế `WHERE version = ?`**: `updateMany` chỉ ghi khi phiên bản
 * trong hàng khớp với phiên bản repository đọc lúc trước. Nhờ vậy test bên dưới
 * kiểm được đúng thứ cần kiểm — repository có gắn đúng điều kiện phiên bản
 * và có dịch "0 hàng khớp" thành mã lỗi ổn định hay không.
 *
 * Nó KHÔNG mô phỏng transaction hay cô lập (isolation). Việc hai transaction
 * thật giành nhau một hàng chỉ chứng minh được bằng Postgres — Giai đoạn 7.
 */
class FakeOrderClient implements OrderPrismaClient {
  readonly rows = new Map<string, SalesOrderWriteRow>();
  readonly lines = new Map<string, OrderLineWriteRow[]>();
  failWith: Error | null = null;

  readonly salesOrder = {
    findUnique: async (args: { where: { id: string } }): Promise<SalesOrderRow | null> => {
      this.#maybeFail();
      const row = this.rows.get(args.where.id);
      if (!row) return null;
      return { ...row, lines: this.lines.get(args.where.id) ?? [] };
    },
    create: async (args: {
      data: SalesOrderWriteRow & { lines: { create: OrderLineWriteRow[] } };
    }): Promise<unknown> => {
      this.#maybeFail();
      const { lines, ...row } = args.data;
      this.rows.set(row.id, row);
      this.lines.set(row.id, [...lines.create]);
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
  };

  readonly orderLine = {
    deleteMany: async (args: { where: { orderId: string } }): Promise<{ count: number }> => {
      this.#maybeFail();
      const removed = this.lines.get(args.where.orderId)?.length ?? 0;
      this.lines.set(args.where.orderId, []);
      return { count: removed };
    },
    createMany: async (args: { data: readonly OrderLineWriteRow[] }): Promise<{ count: number }> => {
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
    // arrange
    const { repository, client } = ctx;

    // confirm
    expect(client.rows.size).toBe(0);

    // act
    const found = await repository.findById('ord_missing');

    // assert
    expect(found).toBeNull();
  });

  it('should rebuild the aggregate rather than hand back the stored row', async () => {
    // arrange
    const { repository } = ctx;
    await repository.save(confirmedOrder());

    // confirm
    expect(ctx.client.rows.size).toBe(1);

    // act
    const found = await repository.findById('ord_1');

    // assert
    expect(found).toBeInstanceOf(Order);
    expect(found?.status).toBe(OrderStatus.Confirmed);
    expect(found?.shippingAddress?.toJSON().recipientName).toBe('Nguyễn Văn A');
  });

  it('should read back exactly the order it wrote', async () => {
    // arrange
    const { repository } = ctx;
    const order = confirmedOrder();
    await repository.save(order);

    // confirm
    expect(order.lines).toHaveLength(1);

    // act
    const found = await repository.findById('ord_1');

    // assert
    expect(found?.toSnapshot()).toEqual(order.toSnapshot());
  });

  it('should treat the stored version as already persisted', async () => {
    // arrange
    const { repository } = ctx;
    const order = confirmedOrder();
    await repository.save(order);

    // confirm
    expect(order.version).toBeGreaterThan(0);

    // act
    const found = await repository.findById('ord_1');

    // assert
    expect(found?.persistedVersion).toBe(order.version);
  });
});

describe('PrismaOrderRepository - writing', () => {
  let ctx: ReturnType<typeof setup>;

  beforeEach(() => {
    ctx = setup();
  });

  it('should insert an order that was never stored before', async () => {
    // arrange
    const { repository, client } = ctx;
    const order = confirmedOrder();

    // confirm
    expect(order.persistedVersion).toBeNull();

    // act
    const result = await repository.save(order);

    // assert
    expect(result.isOk()).toBe(true);
    expect(client.rows.get('ord_1')?.version).toBe(order.version);
  });

  it('should mark the order persisted after a successful write', async () => {
    // arrange
    const { repository } = ctx;
    const order = confirmedOrder();

    // confirm
    expect(order.persistedVersion).toBeNull();

    // act
    await repository.save(order);

    // assert
    expect(order.persistedVersion).toBe(order.version);
  });

  it('should store money as minor units rather than a decimal', async () => {
    // arrange
    const { repository, client } = ctx;

    // confirm
    expect(serum.unitPriceSnapshot.toString()).toBe('459000 VND');

    // act
    await repository.save(confirmedOrder());

    // assert
    expect(client.lines.get('ord_1')?.[0]?.unitPrice).toBe(459000n);
  });

  it('should replace the stored lines instead of piling new ones on top', async () => {
    // arrange
    const { repository, client } = ctx;
    const order = Order.draft({ id: 'ord_1', customerId: 'cus_1', currency: 'VND' });
    order.addQuotedLine(serum);
    order.addQuotedLine(mask);
    await repository.save(order);

    // confirm
    expect(client.lines.get('ord_1')).toHaveLength(2);

    // act
    order.removeLine('var_2');
    await repository.save(order);

    // assert
    expect(client.lines.get('ord_1')).toHaveLength(1);
    expect(client.lines.get('ord_1')?.[0]?.variantId).toBe('var_1');
  });

  it('should let an infrastructure failure surface instead of turning it into a result', async () => {
    // arrange
    const { repository, client } = ctx;
    client.failWith = new Error('connection lost');

    // confirm
    expect(client.rows.size).toBe(0);

    // act
    const act = repository.save(confirmedOrder());

    // assert
    await expect(act).rejects.toThrow('connection lost');
  });
});

describe('PrismaOrderRepository - optimistic locking', () => {
  let ctx: ReturnType<typeof setup>;

  beforeEach(() => {
    ctx = setup();
  });

  it('should guard the update with the version it read', async () => {
    // arrange
    const { repository } = ctx;
    await repository.save(confirmedOrder());
    const reloaded = (await repository.findById('ord_1')) as Order;
    reloaded.markPaid();

    // confirm
    expect(reloaded.version).toBe((reloaded.persistedVersion as number) + 1);

    // act
    const result = await repository.save(reloaded);

    // assert
    expect(result.isOk()).toBe(true);
    expect(ctx.client.rows.get('ord_1')?.status).toBe(OrderStatus.Paid);
  });

  it('should refuse to overwrite an order that changed underneath it', async () => {
    // arrange
    const { repository, client } = ctx;
    await repository.save(confirmedOrder());
    const mine = (await repository.findById('ord_1')) as Order;
    const theirs = (await repository.findById('ord_1')) as Order;
    theirs.markPaid();
    await repository.save(theirs);

    // confirm
    expect(client.rows.get('ord_1')?.status).toBe(OrderStatus.Paid);

    // act
    mine.cancel('Khách đổi ý');
    const result = await repository.save(mine);

    // assert
    expect(result.isErr()).toBe(true);
    expect(result.errorOrNull()?.code).toBe('CONCURRENT_MODIFICATION');
  });

  it('should leave the stored row untouched when it loses the race', async () => {
    // arrange
    const { repository, client } = ctx;
    await repository.save(confirmedOrder());
    const mine = (await repository.findById('ord_1')) as Order;
    const theirs = (await repository.findById('ord_1')) as Order;
    theirs.markPaid();
    await repository.save(theirs);
    const before = { ...client.rows.get('ord_1') } as SalesOrderWriteRow;

    // confirm
    expect(before.status).toBe(OrderStatus.Paid);

    // act
    mine.cancel('Khách đổi ý');
    await repository.save(mine);

    // assert
    expect(client.rows.get('ord_1')).toEqual(before);
    expect(client.lines.get('ord_1')).toHaveLength(1);
  });

  it('should keep the order unpersisted after a lost race so a retry can re-read', async () => {
    // arrange
    const { repository } = ctx;
    await repository.save(confirmedOrder());
    const mine = (await repository.findById('ord_1')) as Order;
    const theirs = (await repository.findById('ord_1')) as Order;
    theirs.markPaid();
    await repository.save(theirs);

    // confirm
    expect(mine.persistedVersion).toBe(mine.version);

    // act
    mine.cancel('Khách đổi ý');
    await repository.save(mine);

    // assert
    expect(mine.persistedVersion).not.toBe(mine.version);
  });
});
