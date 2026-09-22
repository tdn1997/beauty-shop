import { beforeEach, describe, expect, it } from 'vitest';

import { FixedClock } from '../../shared/domain/clock';
import { InventoryLot } from '../domain/inventory-lot';
import {
  InventoryLotRow,
  InventoryPrismaClient,
  PrismaInventoryRepository,
} from './prisma-inventory.repository';

const NOW = new Date('2026-09-17T00:00:00.000Z');

function row(overrides: Partial<InventoryLotRow> = {}): InventoryLotRow {
  return {
    id: 'lot_1',
    variantId: 'var_1',
    lotCode: 'L2609',
    onHand: 10,
    reserved: 0,
    expiresOn: new Date('2027-01-31T00:00:00.000Z'),
    blocked: false,
    blockReason: null,
    version: 0,
    ...overrides,
  };
}

class FakeInventoryClient implements InventoryPrismaClient {
  statements: { sql: string; values: unknown[] }[] = [];
  reads = 0;
  affected = 1;
  stored: InventoryLotRow | null = row();
  failWith: Error | null = null;

  async $executeRaw(query: TemplateStringsArray, ...values: unknown[]): Promise<number> {
    if (this.failWith) throw this.failWith;
    this.statements.push({ sql: query.join('?').replace(/\s+/g, ' ').trim(), values });
    return this.affected;
  }

  readonly inventoryLot = {
    findUnique: async (args: { where: { id: string } }): Promise<InventoryLotRow | null> => {
      if (this.failWith) throw this.failWith;
      this.reads += 1;
      return this.stored && this.stored.id === args.where.id ? this.stored : null;
    },
    findMany: async (args: {
      where: Record<string, unknown>;
      skip: number;
      take: number;
      orderBy: { id: string };
    }): Promise<InventoryLotRow[]> => {
      if (this.failWith) throw this.failWith;
      return this.stored ? [this.stored] : [];
    },
    count: async (args: { where: Record<string, unknown> }): Promise<number> => {
      if (this.failWith) throw this.failWith;
      return this.stored ? 1 : 0;
    },
  };
}

function setup() {
  const client = new FakeInventoryClient();
  const repository = new PrismaInventoryRepository({ current: () => client }, new FixedClock(NOW));
  return { client, repository };
}

describe('PrismaInventoryRepository - reserving stock', () => {
  let ctx: ReturnType<typeof setup>;

  beforeEach(() => {
    ctx = setup();
  });

  it('should hold stock with a single conditional update', async () => {
    const { repository, client } = ctx;
    expect(client.statements).toHaveLength(0);
    const result = await repository.reserve('lot_1', 3);
    expect(result.isOk()).toBe(true);
    expect(client.statements).toHaveLength(1);
  });

  it('should never read the lot before writing to it', async () => {
    const { repository, client } = ctx;
    expect(client.reads).toBe(0);
    await repository.reserve('lot_1', 3);
    expect(client.reads).toBe(0);
  });

  it('should make the available quantity part of the update condition', async () => {
    const { repository, client } = ctx;
    expect(client.affected).toBe(1);
    await repository.reserve('lot_1', 3);
    expect(client.statements[0]?.sql).toMatch(/on_hand"?\s*-\s*"?reserved"?\s*>=/i);
  });

  it('should exclude blocked lots in the update condition', async () => {
    const { repository, client } = ctx;
    expect(client.affected).toBe(1);
    await repository.reserve('lot_1', 3);
    expect(client.statements[0]?.sql).toMatch(/blocked"?\s*=\s*false/i);
  });

  it('should exclude expired lots in the update condition', async () => {
    const { repository, client } = ctx;
    expect(client.affected).toBe(1);
    await repository.reserve('lot_1', 3);
    expect(client.statements[0]?.sql).toMatch(/expires_on"?\s+IS\s+NULL\s+OR/i);
    expect(client.statements[0]?.values).toContainEqual(NOW);
  });

  it('should bump the version in the same statement', async () => {
    const { repository, client } = ctx;
    expect(client.affected).toBe(1);
    await repository.reserve('lot_1', 3);
    expect(client.statements[0]?.sql).toMatch(/version"?\s*=\s*"?version"?\s*\+\s*1/i);
  });

  it('should pass the lot and quantity as parameters rather than inline text', async () => {
    const { repository, client } = ctx;
    expect(client.statements).toHaveLength(0);
    await repository.reserve('lot_1', 3);
    expect(client.statements[0]?.values).toContain('lot_1');
    expect(client.statements[0]?.values).toContain(3);
  });

  it('should reject a quantity that is not a positive integer', async () => {
    const { repository, client } = ctx;
    expect(client.statements).toHaveLength(0);
    const act = () => repository.reserve('lot_1', 0);
    await expect(act()).rejects.toThrow(/INVALID_QUANTITY/);
    expect(client.statements).toHaveLength(0);
  });
});

describe('PrismaInventoryRepository - why a hold failed', () => {
  let ctx: ReturnType<typeof setup>;

  beforeEach(() => {
    ctx = setup();
    ctx.client.affected = 0;
  });

  it('should report a missing lot rather than guessing it is out of stock', async () => {
    const { repository, client } = ctx;
    client.stored = null;
    expect(client.affected).toBe(0);
    const result = await repository.reserve('lot_1', 3);
    expect(result.errorOrNull()?.code).toBe('LOT_NOT_FOUND');
  });

  it('should report a blocked lot rather than out of stock', async () => {
    const { repository, client } = ctx;
    client.stored = row({ blocked: true, blockReason: 'Nghi hỏng bao bì' });
    expect(client.affected).toBe(0);
    const result = await repository.reserve('lot_1', 3);
    expect(result.errorOrNull()?.code).toBe('LOT_BLOCKED');
  });

  it('should report an expired lot rather than out of stock', async () => {
    const { repository, client } = ctx;
    client.stored = row({ expiresOn: new Date('2026-01-01T00:00:00.000Z') });
    expect(client.affected).toBe(0);
    const result = await repository.reserve('lot_1', 3);
    expect(result.errorOrNull()?.code).toBe('LOT_EXPIRED');
  });

  it('should report out of stock when the lot is simply short', async () => {
    const { repository, client } = ctx;
    client.stored = row({ onHand: 10, reserved: 9 });
    expect(client.affected).toBe(0);
    const result = await repository.reserve('lot_1', 3);
    expect(result.errorOrNull()?.code).toBe('OUT_OF_STOCK');
    expect(result.errorOrNull()?.details.available).toBe(1);
  });

  it('should only read the lot after the conditional update missed', async () => {
    const { repository, client } = ctx;
    client.stored = row({ onHand: 10, reserved: 9 });
    expect(client.reads).toBe(0);
    await repository.reserve('lot_1', 3);
    expect(client.reads).toBe(1);
    expect(client.statements).toHaveLength(1);
  });

  it('should let an infrastructure failure surface instead of turning it into a result', async () => {
    const { repository, client } = ctx;
    client.failWith = new Error('connection lost');
    expect(client.statements).toHaveLength(0);
    const act = repository.reserve('lot_1', 3);
    await expect(act).rejects.toThrow('connection lost');
  });
});

describe('PrismaInventoryRepository - reading', () => {
  let ctx: ReturnType<typeof setup>;

  beforeEach(() => {
    ctx = setup();
  });

  it('should rebuild the lot rather than hand back the stored row', async () => {
    const { repository, client } = ctx;
    client.stored = row({ reserved: 4, version: 7 });
    expect(client.reads).toBe(0);
    const lot = await repository.findById('lot_1');
    expect(lot).toBeInstanceOf(InventoryLot);
    expect(lot?.reserved).toBe(4);
    expect(lot?.persistedVersion).toBe(7);
  });

  it('should return null when no row matches', async () => {
    const { repository, client } = ctx;
    client.stored = null;
    expect(client.reads).toBe(0);
    const lot = await repository.findById('lot_1');
    expect(lot).toBeNull();
  });
});
