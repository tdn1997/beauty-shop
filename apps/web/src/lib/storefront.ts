import type { MoneyDto } from './format';

export interface StoreVariant {
  variantId: string;
  sku: string;
  displayName: string;
  price: MoneyDto;
  available: number;
}

export interface StoreProduct {
  id: string;
  name: string;
  description: string;
  category: string;
  imagePath: string | null;
  imageAlt: string | null;
  variants: StoreVariant[];
}

export type SortKey = 'featured' | 'price-asc' | 'price-desc';
export type StockLevel = 'out' | 'low' | 'in';

const LOW_STOCK_THRESHOLD = 10;

const CATEGORY_LABELS: Record<string, string> = {
  cleansing: 'Làm sạch',
  toner: 'Nước hoa hồng',
  serum: 'Serum',
  moisturizer: 'Kem dưỡng',
  sunscreen: 'Chống nắng',
  mask: 'Mặt nạ',
  lips: 'Môi',
  body: 'Cơ thể',
  hair: 'Tóc',
};

export function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category;
}

/** Bỏ dấu tiếng Việt để "sua rua mat" khớp "Sữa Rửa Mặt". */
function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/đ/gi, 'd')
    .toLowerCase();
}

export function filterProducts(
  products: readonly StoreProduct[],
  { query, category }: { query: string; category: string },
): StoreProduct[] {
  const needle = fold(query.trim());
  return products.filter(
    (p) =>
      (category === 'all' || p.category === category) &&
      fold(`${p.name} ${p.description}`).includes(needle),
  );
}

export function lowestPrice(product: StoreProduct): bigint {
  return product.variants
    .map((v) => BigInt(v.price.amount))
    .reduce((min, n) => (n < min ? n : min));
}

/** API xếp biến thể theo mã SKU; người mua cần thấy dung tích nhỏ/rẻ trước. */
export function orderVariantsByPrice(products: readonly StoreProduct[]): StoreProduct[] {
  return products.map((p) => ({
    ...p,
    variants: [...p.variants].sort((a, b) => {
      const [pa, pb] = [BigInt(a.price.amount), BigInt(b.price.amount)];
      return pa === pb ? 0 : pa < pb ? -1 : 1;
    }),
  }));
}

export function sortProducts(products: readonly StoreProduct[], sort: SortKey): StoreProduct[] {
  if (sort === 'featured') return [...products];
  const direction = sort === 'price-asc' ? 1 : -1;
  return [...products].sort((a, b) => {
    const [pa, pb] = [lowestPrice(a), lowestPrice(b)];
    return pa === pb ? 0 : pa < pb ? -direction : direction;
  });
}

export function stockLevel(variant: StoreVariant): StockLevel {
  if (variant.available <= 0) return 'out';
  return variant.available <= LOW_STOCK_THRESHOLD ? 'low' : 'in';
}
