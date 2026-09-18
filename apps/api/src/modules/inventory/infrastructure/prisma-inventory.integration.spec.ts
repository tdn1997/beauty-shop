import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { startPostgres, stopPostgres } from '../../../testcontainers/testcontainers.setup';

describe('PrismaInventory IT', () => {
  let connectionString: string;
  let prisma: PrismaClient;

  beforeAll(async () => {
    connectionString = await startPostgres();
  });

  afterAll(async () => {
    await stopPostgres();
  });

  beforeEach(async () => {
    prisma = new PrismaClient({
      datasources: { db: { url: connectionString } },
    });
  });

  afterEach(async () => {
    await prisma.$executeRaw`TRUNCATE TABLE "inventory_lot" CASCADE`;
    await prisma.$disconnect();
  });

  it('IT07: should reserve stock in one lot and fail for second concurrent request (OUT_OF_STOCK)', async () => {
    const lotId = `lot-it07-${Date.now()}`;

    await prisma.$executeRaw`
      INSERT INTO "inventory_lot" ("id", "variant_id", "lot_code", "on_hand", "reserved", "version", "created_at", "updated_at")
      VALUES (${lotId}, 'VAR001', 'L1', 10, 0, 0, now(), now())
    `;

    const [first, second] = await Promise.allSettled([
      prisma.$executeRaw`
        UPDATE "inventory_lot"
        SET "reserved" = "reserved" + 10, "version" = "version" + 1, "updated_at" = now()
        WHERE "id" = ${lotId}
          AND "blocked" = false
          AND "on_hand" - "reserved" >= 10
          AND ("expires_on" IS NULL OR "expires_on" > now()::date)
      `,
      prisma.$executeRaw`
        UPDATE "inventory_lot"
        SET "reserved" = "reserved" + 10, "version" = "version" + 1, "updated_at" = now()
        WHERE "id" = ${lotId}
          AND "blocked" = false
          AND "on_hand" - "reserved" >= 10
          AND ("expires_on" IS NULL OR "expires_on" > now()::date)
      `,
    ]);

    const outcomes = [first, second].map((r) =>
      r.status === 'fulfilled' ? (r as PromiseFulfilledResult<number>).value : -1,
    );
    const successes = outcomes.filter((v) => v === 1);
    expect(successes).toHaveLength(1);
  });

  it('IT08: should prevent reserved from exceeding on_hand through CHECK constraint', async () => {
    const lotId = `lot-it08-${Date.now()}`;

    await prisma.$executeRaw`
      INSERT INTO "inventory_lot" ("id", "variant_id", "lot_code", "on_hand", "reserved", "version", "created_at", "updated_at")
      VALUES (${lotId}, 'VAR002', 'L2', 5, 0, 0, now(), now())
    `;

    await expect(
      prisma.$executeRaw`
        UPDATE "inventory_lot"
        SET "reserved" = 15
        WHERE "id" = ${lotId}
      `,
    ).rejects.toThrow();
  });

  it('IT09: should exclude blocked lots from available reserve', async () => {
    const lotId = `lot-it09-${Date.now()}`;

    await prisma.$executeRaw`
      INSERT INTO "inventory_lot" ("id", "variant_id", "lot_code", "on_hand", "reserved", "blocked", "block_reason", "version", "created_at", "updated_at")
      VALUES (${lotId}, 'VAR003', 'L3', 10, 0, true, 'Nghi hỏng bao bì', 0, now(), now())
    `;

    const affected = await prisma.$executeRaw`
      UPDATE "inventory_lot"
      SET "reserved" = "reserved" + 5, "version" = "version" + 1, "updated_at" = now()
      WHERE "id" = ${lotId}
        AND "blocked" = false
        AND "on_hand" - "reserved" >= 5
    `;

    expect(affected).toBe(0);

    const rows = await prisma.$queryRaw<{ reserved: number }[]>`
      SELECT "reserved" FROM "inventory_lot" WHERE "id" = ${lotId}
    `;
    expect(rows[0]!.reserved).toBe(0);
  });

  it('IT10: should exclude expired lots from available reserve', async () => {
    const lotId = `lot-it10-${Date.now()}`;
    const expiredDate = '2020-01-01';

    await prisma.$executeRaw`
      INSERT INTO "inventory_lot" ("id", "variant_id", "lot_code", "on_hand", "reserved", "expires_on", "version", "created_at", "updated_at")
      VALUES (${lotId}, 'VAR004', 'L4', 10, 0, ${expiredDate}::date, 0, now(), now())
    `;

    const affected = await prisma.$executeRaw`
      UPDATE "inventory_lot"
      SET "reserved" = "reserved" + 5, "version" = "version" + 1, "updated_at" = now()
      WHERE "id" = ${lotId}
        AND "blocked" = false
        AND "on_hand" - "reserved" >= 5
        AND ("expires_on" IS NULL OR "expires_on" > now()::date)
    `;

    expect(affected).toBe(0);

    const rows = await prisma.$queryRaw<{ reserved: number }[]>`
      SELECT "reserved" FROM "inventory_lot" WHERE "id" = ${lotId}
    `;
    expect(rows[0]!.reserved).toBe(0);
  });

  it('IT11: should bump version on reserve and detect concurrent modification', async () => {
    const lotId = `lot-it11-${Date.now()}`;

    await prisma.$executeRaw`
      INSERT INTO "inventory_lot" ("id", "variant_id", "lot_code", "on_hand", "reserved", "version", "created_at", "updated_at")
      VALUES (${lotId}, 'VAR005', 'L5', 20, 0, 0, now(), now())
    `;

    const [first, second] = await Promise.allSettled([
      prisma.$executeRaw`
        UPDATE "inventory_lot"
        SET "reserved" = "reserved" + 5, "version" = "version" + 1, "updated_at" = now()
        WHERE "id" = ${lotId} AND "version" = 0
      `,
      prisma.$executeRaw`
        UPDATE "inventory_lot"
        SET "reserved" = "reserved" + 5, "version" = "version" + 1, "updated_at" = now()
        WHERE "id" = ${lotId} AND "version" = 0
      `,
    ]);

    const outcomes = [first, second].map((r) =>
      r.status === 'fulfilled' ? (r as PromiseFulfilledResult<number>).value : -1,
    );
    const successes = outcomes.filter((v) => v === 1);
    expect(successes).toHaveLength(1);

    const rows = await prisma.$queryRaw<{ version: number }[]>`
      SELECT "version" FROM "inventory_lot" WHERE "id" = ${lotId}
    `;
    expect(rows[0]!.version).toBe(1);
  });
});
