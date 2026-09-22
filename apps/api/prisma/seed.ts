import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface VariantSeed {
  id: string;
  sku: string;
  name: string;
  listPrice: bigint;
}

interface ProductSeed {
  id: string;
  name: string;
  variants: VariantSeed[];
}

interface LotSeed {
  variantId: string;
  lotCode: string;
  onHand: number;
}

const PRODUCTS: ProductSeed[] = [
  {
    id: 'prod-serum',
    name: 'Serum Dưỡng Ẩm',
    variants: [
      { id: 'SKU-SERUM-15', sku: 'SKU-SERUM-15', name: '15ml', listPrice: 150000n },
      { id: 'SKU-SERUM-30', sku: 'SKU-SERUM-30', name: '30ml', listPrice: 280000n },
    ],
  },
  {
    id: 'prod-spf50',
    name: 'Kem Chống Nắng SPF50+',
    variants: [
      { id: 'SKU-SPF50-50G', sku: 'SKU-SPF50-50G', name: '50g', listPrice: 220000n },
      { id: 'SKU-SPF50-100G', sku: 'SKU-SPF50-100G', name: '100g', listPrice: 390000n },
    ],
  },
  {
    id: 'prod-facewash',
    name: 'Sữa Rửa Mặt CeraVe',
    variants: [
      { id: 'SKU-FACEWASH-100', sku: 'SKU-FACEWASH-100', name: '100ml', listPrice: 95000n },
    ],
  },
  {
    id: 'prod-vitc',
    name: 'Tinh Chất Vitamin C',
    variants: [
      { id: 'SKU-VITC-10ML', sku: 'SKU-VITC-10ML', name: '10ml', listPrice: 180000n },
      { id: 'SKU-VITC-20ML', sku: 'SKU-VITC-20ML', name: '20ml', listPrice: 340000n },
    ],
  },
];

// Một lot cố ý ít hàng (SKU-SPF50-100G) và một lot cố ý hết hàng (SKU-VITC-10ML)
// để demo màu cảnh báo tồn kho ở trang admin mà không cần thao tác thêm.
const LOTS: LotSeed[] = [
  { variantId: 'SKU-SERUM-15', lotCode: 'LOT-001', onHand: 50 },
  { variantId: 'SKU-SERUM-30', lotCode: 'LOT-002', onHand: 30 },
  { variantId: 'SKU-SPF50-50G', lotCode: 'LOT-003', onHand: 40 },
  { variantId: 'SKU-SPF50-100G', lotCode: 'LOT-004', onHand: 5 },
  { variantId: 'SKU-FACEWASH-100', lotCode: 'LOT-005', onHand: 100 },
  { variantId: 'SKU-VITC-10ML', lotCode: 'LOT-006', onHand: 0 },
  { variantId: 'SKU-VITC-20ML', lotCode: 'LOT-007', onHand: 20 },
];

async function main() {
  console.log('Seeding BeautyShop demo data...');

  for (const p of PRODUCTS) {
    await prisma.product.upsert({
      where: { id: p.id },
      create: { id: p.id, name: p.name, status: 'ACTIVE' },
      update: { name: p.name, status: 'ACTIVE' },
    });
    for (const v of p.variants) {
      await prisma.productVariant.upsert({
        where: { id: v.id },
        create: {
          id: v.id,
          productId: p.id,
          sku: v.sku,
          name: `${p.name} ${v.name}`,
          listPrice: v.listPrice,
          currency: 'VND',
          status: 'ACTIVE',
        },
        update: {
          name: `${p.name} ${v.name}`,
          listPrice: v.listPrice,
          currency: 'VND',
          status: 'ACTIVE',
        },
      });
    }
  }

  for (const lot of LOTS) {
    await prisma.inventoryLot.upsert({
      where: { variantId_lotCode: { variantId: lot.variantId, lotCode: lot.lotCode } },
      create: {
        id: `inv-${lot.lotCode.toLowerCase()}`,
        variantId: lot.variantId,
        lotCode: lot.lotCode,
        onHand: lot.onHand,
      },
      update: { onHand: lot.onHand },
    });
  }

  await prisma.customerAddress.upsert({
    where: { id: 'default' },
    create: {
      id: 'default',
      customerId: 'test-customer-1',
      recipientName: 'Nguyễn Văn A',
      phone: '0901234567',
      line1: '123 Đường Lê Lợi',
      line2: null,
      ward: 'Phường Bến Nghé',
      district: 'Quận 1',
      province: 'TPHCM',
    },
    update: {},
  });

  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
