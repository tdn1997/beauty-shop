import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startPostgres, stopPostgres } from '../../src/testcontainers/testcontainers.setup';
import { catalogFixtures } from './catalog.fixtures';
import { seedDemo } from './seed-demo';
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
    expect(await prisma.inventoryLot.count()).toBe(27);
    expect(await prisma.user.count()).toBe(3);
    expect(await prisma.customerAddress.count()).toBe(3);
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
    await seedDemo(prisma, env);
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
