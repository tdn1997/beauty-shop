import type { PrismaClient } from '@prisma/client';
import { ScryptPasswordHasher } from '../../src/modules/iam/infrastructure/scrypt-password-hasher';
import { catalogFixtures, lotFixtures } from './catalog.fixtures';
import { buildExtraLotFixtures, buildOrderFixtures } from './orders.fixtures';
import { userFixtures } from './users.fixtures';
const LEGACY_PLACEHOLDER_HASH = 'disabled';
const LEGACY_PLACEHOLDER_DOMAIN = '@legacy.invalid';

export async function seedDemo(
  prisma: PrismaClient,
  env: NodeJS.ProcessEnv = process.env,
  now: Date = new Date(),
) {
  if (env.NODE_ENV === 'production') throw new Error('Demo seed is forbidden in production');
  if (env.BEAUTYSHOP_DEMO_SEED !== 'true')
    throw new Error('Set BEAUTYSHOP_DEMO_SEED=true explicitly');
  const passwords = new Map<string, string>();
  for (const u of userFixtures) {
    const value = env[u.passwordEnv];
    if (!value) throw new Error(`Missing ${u.passwordEnv}`);
    passwords.set(u.id, value);
  }
  const orders = buildOrderFixtures(now);
  const extraLots = buildExtraLotFixtures(now, orders);
  const hasher = new ScryptPasswordHasher();
  const hashes = new Map<string, string>();
  for (const u of userFixtures) hashes.set(u.id, await hasher.hash(passwords.get(u.id)!));
  await prisma.$transaction(async (tx) => {
    for (const p of catalogFixtures) {
      const collision = await tx.product.findUnique({ where: { id: p.id } });
      if (collision && collision.name !== p.name && !p.previousNames.includes(collision.name))
        throw new Error(`Product identifier collision: ${p.id}`);
      await tx.product.upsert({
        where: { id: p.id },
        create: {
          id: p.id,
          name: p.name,
          description: p.description,
          category: p.category,
          imagePath: p.imagePath,
          imageAlt: p.imageAlt,
          displayOrder: p.displayOrder,
          status: 'ACTIVE',
        },
        update: {
          name: p.name,
          description: p.description,
          category: p.category,
          imagePath: p.imagePath,
          imageAlt: p.imageAlt,
          displayOrder: p.displayOrder,
          status: 'ACTIVE',
        },
      });
      for (const v of p.variants) {
        const bySku = await tx.productVariant.findUnique({ where: { sku: v.sku } });
        if (bySku && bySku.id !== v.id) throw new Error(`SKU collision: ${v.sku}`);
        await tx.productVariant.upsert({
          where: { id: v.id },
          create: {
            id: v.id,
            productId: p.id,
            sku: v.sku,
            name: `${p.name} ${v.displayName}`,
            displayName: v.displayName,
            listPrice: v.listPrice,
            currency: 'VND',
            status: 'ACTIVE',
          },
          update: {
            productId: p.id,
            sku: v.sku,
            name: `${p.name} ${v.displayName}`,
            displayName: v.displayName,
            listPrice: v.listPrice,
            currency: 'VND',
            status: 'ACTIVE',
          },
        });
      }
    }
    for (const l of lotFixtures)
      await tx.inventoryLot.upsert({
        where: { variantId_lotCode: { variantId: l.variantId, lotCode: l.lotCode } },
        create: l,
        update: {},
      });
    // Chỉ tạo, không cập nhật: lô và đơn đã có là trạng thái vận hành, seed lại không ghi đè.
    // Lô B mang phần giữ chỗ của đơn mở nên được tạo cùng transaction với các đơn đó.
    for (const l of extraLots)
      await tx.inventoryLot.upsert({
        where: { variantId_lotCode: { variantId: l.variantId, lotCode: l.lotCode } },
        create: l,
        update: {},
      });
    for (const u of userFixtures) {
      const normalized = u.email.toLowerCase();
      const collision = await tx.user.findUnique({ where: { email: normalized } });
      if (collision && collision.id !== u.id) throw new Error(`Email collision: ${normalized}`);
      const account = {
        email: normalized,
        displayName: u.displayName,
        passwordHash: hashes.get(u.id)!,
        role: u.role,
        enabled: true,
      };
      const existing = await tx.user.findUnique({ where: { id: u.id } });
      // Placeholder do migration 20260922070000 chèn cho khách cũ chưa có thông tin đăng nhập:
      // chưa ai "sở hữu" nó nên seed được nhận. Tài khoản thật đã tồn tại thì giữ nguyên.
      const isMigrationPlaceholder =
        existing?.passwordHash === LEGACY_PLACEHOLDER_HASH &&
        existing.email.endsWith(LEGACY_PLACEHOLDER_DOMAIN);
      await tx.user.upsert({
        where: { id: u.id },
        create: { id: u.id, ...account },
        update: isMigrationPlaceholder ? account : {},
      });
      await tx.customerAddress.upsert({
        where: { id: u.address.id },
        create: { ...u.address, customerId: u.id },
        update: {},
      });
    }
    for (const { lines, ship, ...o } of orders)
      await tx.salesOrder.upsert({
        where: { id: o.id },
        create: {
          ...o,
          currency: 'VND',
          shipRecipientName: ship.recipientName,
          shipPhone: ship.phone,
          shipLine1: ship.line1,
          shipLine2: ship.line2,
          shipWard: ship.ward,
          shipDistrict: ship.district,
          shipProvince: ship.province,
          updatedAt: o.createdAt,
          lines: { create: lines },
        },
        update: {},
      });
  });
  return {
    products: catalogFixtures.length,
    variants: catalogFixtures.reduce((n, p) => n + p.variants.length, 0),
    lots: lotFixtures.length + extraLots.length,
    orders: orders.length,
    users: userFixtures.length,
  };
}
