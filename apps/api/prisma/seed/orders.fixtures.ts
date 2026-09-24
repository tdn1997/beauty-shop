import { catalogFixtures } from './catalog.fixtures';
import { userFixtures } from './users.fixtures';

type SeedStatus = 'CONFIRMED' | 'PAID' | 'DISPATCHED' | 'CANCELLED';

export interface OrderLineFixture {
  id: string;
  variantId: string;
  sku: string;
  nameSnapshot: string;
  unitPrice: bigint;
  quantity: number;
}

export interface OrderFixture {
  id: string;
  customerId: string;
  status: SeedStatus;
  cancellationReason: string | null;
  discount: bigint;
  shippingFee: bigint;
  ship: {
    recipientName: string;
    phone: string;
    line1: string;
    line2: string | null;
    ward: string;
    district: string;
    province: string;
  };
  createdAt: Date;
  lines: OrderLineFixture[];
}

export interface ExtraLotFixture {
  id: string;
  variantId: string;
  lotCode: string;
  onHand: number;
  reserved: number;
  expiresOn: Date;
  blocked: boolean;
  blockReason: string | null;
}

const DAY_MS = 86_400_000;
/** Cũ → mới. D = DISPATCHED, P = PAID, C = CONFIRMED, X = CANCELLED. */
const STATUS_TIMELINE = 'DDXDDDDXDDDDDXDDDPXPCPCXCPCCPC';
const STATUS: Record<string, SeedStatus> = {
  D: 'DISPATCHED',
  P: 'PAID',
  C: 'CONFIRMED',
  X: 'CANCELLED',
};
const CANCEL_REASONS = [
  'Khách yêu cầu huỷ',
  'Thanh toán không thành công',
  'Khách đặt nhầm dung tích',
  'Không liên lạc được người nhận',
];
/** Không bán được (hết hàng / lô sắp hết hạn chỉ còn ít) → không xuất hiện trong đơn mở. */
const NOT_RESERVABLE = new Set(['SKU-VITC-10ML', 'SKU-SPF50-100G']);
/** Giá trước đợt điều chỉnh: đơn cũ hơn mốc này giữ giá snapshot thấp hơn giá hiện tại. */
const PRICE_CHANGE_DAYS_AGO = 30;

// Quy tắc giống PricingModule: giảm 10% (trần 100k) và miễn phí giao từ 500k, dưới đó 30k.
const THRESHOLD = 500_000n;
const discountFor = (items: bigint) => {
  if (items < THRESHOLD) return 0n;
  const tenPercent = items / 10n;
  return tenPercent < 100_000n ? tenPercent : 100_000n;
};
const shippingFor = (items: bigint) => (items >= THRESHOLD ? 0n : 30_000n);

/** PRNG tất định — seed chạy lại ra đúng cùng bộ đơn. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ (t + t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const variants = catalogFixtures.flatMap((p) =>
  p.variants.map((v) => ({ ...v, name: `${p.name} ${v.displayName}` })),
);
const customers = userFixtures.filter((u) => u.role === 'CUSTOMER');

export function buildOrderFixtures(now: Date): OrderFixture[] {
  const rand = mulberry32(2026);
  const pick = <T>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)]!;
  const daysAgo = Array.from({ length: STATUS_TIMELINE.length }, () =>
    Math.floor(rand() * 45),
  ).sort((a, b) => b - a);
  let cancelled = 0;
  return [...STATUS_TIMELINE].map((code, i) => {
    const status = STATUS[code]!;
    const open = status === 'CONFIRMED' || status === 'PAID';
    const age = daysAgo[i]!;
    const id = `ord-demo-${String(i + 1).padStart(3, '0')}`;
    const pool = variants.filter((v) => !(open && NOT_RESERVABLE.has(v.id)));
    const chosen = new Map<string, (typeof pool)[number]>();
    const lineCount = 1 + Math.floor(rand() * 3);
    while (chosen.size < lineCount) {
      const v = pick(pool);
      chosen.set(v.id, v);
    }
    const lines = [...chosen.values()].map((v, n) => ({
      id: `${id}-${n + 1}`,
      variantId: v.id,
      sku: v.sku,
      nameSnapshot: v.name,
      unitPrice:
        age > PRICE_CHANGE_DAYS_AGO ? ((v.listPrice * 95n) / 100n / 1000n) * 1000n : v.listPrice,
      quantity: 1 + Math.floor(rand() * 2),
    }));
    const items = lines.reduce((n, l) => n + l.unitPrice * BigInt(l.quantity), 0n);
    const customer = pick(customers);
    const { id: _addressId, ...ship } = customer.address;
    return {
      id,
      customerId: customer.id,
      status,
      cancellationReason:
        status === 'CANCELLED' ? CANCEL_REASONS[cancelled++ % CANCEL_REASONS.length]! : null,
      discount: discountFor(items),
      shippingFee: shippingFor(items),
      ship,
      createdAt: new Date(now.getTime() - age * DAY_MS - Math.floor(rand() * 10) * 3_600_000),
      lines,
    };
  });
}

/**
 * Lô thứ hai cho mỗi biến thể (hạn dùng khác nhau), cộng một lô bị khoá kiểm định
 * và một lô đã hết hạn. Phần `reserved` của lô B bằng đúng lượng các đơn mở đang giữ —
 * giống kết quả nếu các đơn đó đi qua checkout thật.
 */
export function buildExtraLotFixtures(
  now: Date,
  orders: readonly OrderFixture[],
): ExtraLotFixture[] {
  const held = new Map<string, number>();
  for (const o of orders)
    if (o.status === 'CONFIRMED' || o.status === 'PAID')
      for (const l of o.lines) held.set(l.variantId, (held.get(l.variantId) ?? 0) + l.quantity);
  const inDays = (d: number) =>
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + d));
  const lots: ExtraLotFixture[] = [];
  catalogFixtures.forEach((p) =>
    p.variants.forEach((v, i) => {
      const suffix = v.sku.replace('SKU-', '');
      if (v.id === 'SKU-VITC-10ML') {
        lots.push({
          id: `inv-${v.sku.toLowerCase()}-exp`,
          variantId: v.id,
          lotCode: `LOT-${suffix}-EXP`,
          onHand: 12,
          reserved: 0,
          expiresOn: inDays(-20),
          blocked: false,
          blockReason: null,
        });
        return;
      }
      const nearExpiry = v.id === 'SKU-SPF50-100G';
      const onHand = nearExpiry ? 3 : 30 + ((p.displayOrder * 5 + i * 13) % 60);
      const reserved = held.get(v.id) ?? 0;
      if (reserved > onHand) throw new Error(`Seed reserves more than lot holds: ${v.id}`);
      lots.push({
        id: `inv-${v.sku.toLowerCase()}-b`,
        variantId: v.id,
        lotCode: `LOT-${suffix}-B`,
        onHand,
        reserved,
        expiresOn: inDays(nearExpiry ? 25 : 180 + ((p.displayOrder * 37 + i * 91) % 540)),
        blocked: false,
        blockReason: null,
      });
    }),
  );
  lots.push({
    id: 'inv-sku-serum-30-qc',
    variantId: 'SKU-SERUM-30',
    lotCode: 'LOT-SERUM-30-QC',
    onHand: 15,
    reserved: 0,
    expiresOn: inDays(400),
    blocked: true,
    blockReason: 'Chờ kiểm định chất lượng lô nhập',
  });
  return lots;
}
