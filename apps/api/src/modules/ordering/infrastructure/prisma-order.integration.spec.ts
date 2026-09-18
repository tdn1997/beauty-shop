import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { OrderStatus } from '../domain/order';
import { startPostgres, stopPostgres } from '../../../testcontainers/testcontainers.setup';

const serum = {
  variantId: 'var_1',
  sku: 'SRM-VTC-30',
  nameSnapshot: 'Serum Vitamin C 30ml',
  unitPrice: 459000n,
  quantity: 2,
};

describe('PrismaOrder IT', () => {
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
    await prisma.$executeRaw`TRUNCATE TABLE "order_line" CASCADE`;
    await prisma.$executeRaw`TRUNCATE TABLE "sales_order" CASCADE`;
    await prisma.$disconnect();
  });

  it('IT01: should insert and read back an order with lines', async () => {
    const orderId = `ord-it01-${Date.now()}`;

    await prisma.salesOrder.create({
      data: {
        id: orderId,
        customerId: 'customer-it01',
        currency: 'VND',
        status: OrderStatus.Draft,
        version: 0,
        discount: 0n,
        shippingFee: 0n,
        lines: {
          create: [
            {
              id: `${orderId}:var_1`,
              variantId: serum.variantId,
              sku: serum.sku,
              nameSnapshot: serum.nameSnapshot,
              unitPrice: serum.unitPrice,
              quantity: serum.quantity,
            },
          ],
        },
      },
    });

    const row = await prisma.salesOrder.findUnique({
      where: { id: orderId },
      include: { lines: true },
    });

    expect(row).not.toBeNull();
    expect(row!.lines).toHaveLength(1);
    expect(row!.lines[0].variantId).toBe(serum.variantId);
  });

  it('IT02: should enforce CHECK constraints: cancelled order must have reason', async () => {
    const orderId = `ord-it02-${Date.now()}`;

    await expect(
      prisma.salesOrder.create({
        data: {
          id: orderId,
          customerId: 'customer-it02',
          currency: 'VND',
          status: OrderStatus.Cancelled,
          version: 0,
          cancellationReason: null,
        },
      }),
    ).rejects.toThrow();
  });

  it('IT03: should enforce CHECK constraints: shipping address required before confirming', async () => {
    const orderId = `ord-it03-${Date.now()}`;

    await expect(
      prisma.salesOrder.create({
        data: {
          id: orderId,
          customerId: 'customer-it03',
          currency: 'VND',
          status: OrderStatus.Confirmed,
          version: 0,
          shipRecipientName: null,
          shipPhone: null,
          shipLine1: null,
          shipWard: null,
          shipDistrict: null,
          shipProvince: null,
        },
      }),
    ).rejects.toThrow();
  });

  it('IT04: should optimistic lock: concurrent update to same order fails for second writer', async () => {
    const orderId = `ord-it04-${Date.now()}`;

    await prisma.$executeRaw`
      INSERT INTO "sales_order" ("id", "customer_id", "currency", "status", "version", "ship_recipient_name", "ship_phone", "ship_line1", "ship_ward", "ship_district", "ship_province", "created_at", "updated_at")
      VALUES (${orderId}, 'customer-it04', 'VND', 'DRAFT', 0, 'Nguyen Van A', '0901234567', '12 Ly Thuong Kiet', 'Phuong 7', 'Quan 10', 'TP. Ho Chi Minh', now(), now())
    `;

    const firstResult = await prisma.$executeRaw`
      UPDATE "sales_order"
      SET "status" = 'CONFIRMED', "version" = "version" + 1, "updated_at" = now()
      WHERE "id" = ${orderId} AND "version" = 0
    `;

    const secondResult = await prisma.$executeRaw`
      UPDATE "sales_order"
      SET "status" = 'PAID', "version" = "version" + 1, "updated_at" = now()
      WHERE "id" = ${orderId} AND "version" = 0
    `;

    expect(firstResult).toBe(1);
    expect(secondResult).toBe(0);

    const row = await prisma.salesOrder.findUnique({ where: { id: orderId } });
    expect(row!.status).toBe(OrderStatus.Confirmed);
    expect(row!.version).toBe(1);
  });

  it('IT05: should not allow duplicate variantId in same order (UNIQUE constraint)', async () => {
    const orderId = `ord-it05-${Date.now()}`;

    await prisma.salesOrder.create({
      data: {
        id: orderId,
        customerId: 'customer-it05',
        currency: 'VND',
        status: OrderStatus.Draft,
        version: 0,
      },
    });

    await prisma.orderLine.create({
      data: {
        id: `${orderId}:var_1`,
        orderId,
        variantId: 'var_duplicate',
        sku: 'SKU001',
        nameSnapshot: 'Product 1',
        unitPrice: 100000n,
        quantity: 1,
      },
    });

    await expect(
      prisma.orderLine.create({
        data: {
          id: `${orderId}:var_2`,
          orderId,
          variantId: 'var_duplicate',
          sku: 'SKU002',
          nameSnapshot: 'Product 2',
          unitPrice: 200000n,
          quantity: 1,
        },
      }),
    ).rejects.toThrow();
  });

  it('IT06: should preserve discount and shipping snapshots through save/reload', async () => {
    const orderId = `ord-it06-${Date.now()}`;

    await prisma.salesOrder.create({
      data: {
        id: orderId,
        customerId: 'customer-it06',
        currency: 'VND',
        status: OrderStatus.Draft,
        version: 0,
        discount: 50000n,
        shippingFee: 30000n,
      },
    });

    const row = await prisma.salesOrder.findUnique({ where: { id: orderId } });
    expect(row!.discount).toBe(50000n);
    expect(row!.shippingFee).toBe(30000n);
  });
});
