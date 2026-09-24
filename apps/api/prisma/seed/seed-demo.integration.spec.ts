import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startPostgres, stopPostgres } from '../../src/testcontainers/testcontainers.setup';
import { catalogFixtures } from './catalog.fixtures';
import { seedDemo } from './seed-demo';
import { ScryptPasswordHasher } from '../../src/modules/iam/infrastructure/scrypt-password-hasher';
const env = {
  NODE_ENV: 'test',
  BEAUTYSHOP_DEMO_SEED: 'true',
  SEED_ADMIN_PASSWORD: 'admin-password-123',
  SEED_CUSTOMER_PASSWORD: 'customer-password-123',
  SEED_CUSTOMER2_PASSWORD: 'customer2-password-123',
};
describe('demo seed integration', () => {
  let prisma: PrismaClient;
  beforeAll(async () => {
    prisma = new PrismaClient({ datasources: { db: { url: await startPostgres() } } });
  });
  afterAll(async () => {
    await prisma.$disconnect();
    await stopPostgres();
  });
  it('should create exactly the canonical fresh fixture counts', async () => {
    await seedDemo(prisma, env);
    expect(await prisma.product.count()).toBe(16);
    expect(await prisma.productVariant.count()).toBe(27);
    expect(await prisma.inventoryLot.count()).toBe(55);
    expect(await prisma.user.count()).toBe(7);
    expect(await prisma.customerAddress.count()).toBe(7);
    expect(await prisma.salesOrder.count()).toBe(30);
  });
  it('should reserve exactly the quantities held by open orders', async () => {
    // arrange
    const open = await prisma.orderLine.groupBy({
      by: ['variantId'],
      where: { order: { status: { in: ['CONFIRMED', 'PAID'] } } },
      _sum: { quantity: true },
    });
    // confirm
    expect(open.length).toBeGreaterThan(0);
    // act
    const reserved = await prisma.inventoryLot.groupBy({
      by: ['variantId'],
      where: { reserved: { gt: 0 } },
      _sum: { reserved: true },
    });
    // assert
    const toMap = (rows: { variantId: string; n: number | null }[]) =>
      Object.fromEntries(rows.map((r) => [r.variantId, r.n]));
    expect(toMap(reserved.map((r) => ({ variantId: r.variantId, n: r._sum.reserved })))).toEqual(
      toMap(open.map((r) => ({ variantId: r.variantId, n: r._sum.quantity }))),
    );
  });
  it('should price every seeded order with the checkout discount and shipping rules', async () => {
    // act
    const orders = await prisma.salesOrder.findMany({ include: { lines: true } });
    // assert
    for (const o of orders) {
      const items = o.lines.reduce((n, l) => n + l.unitPrice * BigInt(l.quantity), 0n);
      const qualifies = items >= 500000n;
      const tenPercent = items / 10n;
      expect(o.shippingFee).toBe(qualifies ? 0n : 30000n);
      expect(o.discount).toBe(qualifies ? (tenPercent < 100000n ? tenPercent : 100000n) : 0n);
      expect(o.shipProvince).not.toBeNull();
    }
    expect(new Set(orders.map((o) => o.status))).toEqual(
      new Set(['CONFIRMED', 'PAID', 'DISPATCHED', 'CANCELLED']),
    );
  });
  it('should keep an expired lot out of the storefront availability', async () => {
    // act
    const lots = await prisma.inventoryLot.findMany({ where: { variantId: 'SKU-VITC-10ML' } });
    // assert
    const sellable = lots.filter((l) => !l.blocked && (!l.expiresOn || l.expiresOn >= new Date()));
    expect(lots.some((l) => l.onHand > 0)).toBe(true);
    expect(sellable.reduce((n, l) => n + l.onHand - l.reserved, 0)).toBe(0);
  });
  it('should preserve operational and edited user state on a second seed', async () => {
    const before = await prisma.user.findUniqueOrThrow({ where: { id: 'test-customer-1' } });
    await prisma.user.update({
      where: { id: before.id },
      data: { enabled: false, role: 'ADMIN', displayName: 'Edited' },
    });
    await prisma.customerAddress.update({
      where: { id: 'default' },
      data: { line1: 'Edited address' },
    });
    await prisma.inventoryLot.update({
      where: { variantId_lotCode: { variantId: 'SKU-SERUM-15', lotCode: 'LOT-001' } },
      data: { onHand: 49, reserved: 3, version: 8 },
    });
    const countsBefore = [await prisma.salesOrder.count(), await prisma.inventoryLot.count()];
    await seedDemo(prisma, env);
    expect([await prisma.salesOrder.count(), await prisma.inventoryLot.count()]).toEqual(
      countsBefore,
    );
    const user = await prisma.user.findUniqueOrThrow({ where: { id: before.id } }),
      address = await prisma.customerAddress.findUniqueOrThrow({ where: { id: 'default' } }),
      lot = await prisma.inventoryLot.findUniqueOrThrow({
        where: { variantId_lotCode: { variantId: 'SKU-SERUM-15', lotCode: 'LOT-001' } },
      });
    expect(user).toMatchObject({
      passwordHash: before.passwordHash,
      enabled: false,
      role: 'ADMIN',
      displayName: 'Edited',
    });
    expect(address.line1).toBe('Edited address');
    expect(lot).toMatchObject({ onHand: 49, reserved: 3, version: 8 });
  });
  it('should turn a migration login placeholder into the real demo user', async () => {
    // arrange — đúng hình dạng migration 20260922070000 chèn cho khách cũ có địa chỉ
    await prisma.user.update({
      where: { id: 'test-customer-1' },
      data: {
        email: 'disabled+legacy@legacy.invalid',
        displayName: 'Legacy customer',
        passwordHash: 'disabled',
        role: 'CUSTOMER',
        enabled: false,
      },
    });
    // act
    await seedDemo(prisma, env);
    // assert
    const user = await prisma.user.findUniqueOrThrow({ where: { id: 'test-customer-1' } });
    expect(user).toMatchObject({
      email: 'customer@beautyshop.test',
      displayName: 'Nguyễn Văn A',
      role: 'CUSTOMER',
      enabled: true,
    });
    expect(
      await new ScryptPasswordHasher().verify(env.SEED_CUSTOMER_PASSWORD, user.passwordHash),
    ).toBe(true);
  });
  it('should rename a product still stored under a previous fixture name', async () => {
    // arrange
    const fixture = catalogFixtures.find((p) => p.id === 'prod-serum')!;
    const legacyName = fixture.previousNames[0]!;
    await prisma.product.update({ where: { id: fixture.id }, data: { name: legacyName } });
    // confirm
    expect(legacyName).not.toBe(fixture.name);
    // act
    await seedDemo(prisma, env);
    // assert
    const product = await prisma.product.findUniqueOrThrow({ where: { id: fixture.id } });
    expect(product.name).toBe(fixture.name);
  });
  it('should reject a product whose stored name matches no known fixture name', async () => {
    // arrange
    await prisma.product.update({ where: { id: 'prod-serum' }, data: { name: 'Foreign serum' } });
    const before = await prisma.product.findMany({ orderBy: { id: 'asc' } });
    // act
    const seeding = seedDemo(prisma, env);
    // assert
    await expect(seeding).rejects.toThrow('Product identifier collision: prod-serum');
    expect(await prisma.product.findMany({ orderBy: { id: 'asc' } })).toEqual(before);
    await prisma.product.update({
      where: { id: 'prod-serum' },
      data: { name: catalogFixtures[0]!.name },
    });
  });
  it('should roll back all writes when a collision exists', async () => {
    await prisma.product.create({ data: { id: 'collision', name: 'Before', status: 'ACTIVE' } });
    await prisma.productVariant.update({
      where: { id: 'SKU-TONER-150ML' },
      data: { sku: 'SKU-COLLISION-TEMP' },
    });
    await prisma.productVariant.create({
      data: {
        id: 'foreign',
        productId: 'collision',
        sku: 'SKU-TONER-150ML',
        name: 'Foreign',
        displayName: 'Foreign',
        listPrice: 1n,
        currency: 'VND',
        status: 'ACTIVE',
      },
    });
    const before = await prisma.product.findUniqueOrThrow({ where: { id: 'prod-serum' } });
    await expect(seedDemo(prisma, env)).rejects.toThrow('SKU collision');
    expect(await prisma.product.findUniqueOrThrow({ where: { id: 'prod-serum' } })).toEqual(before);
  });
});
