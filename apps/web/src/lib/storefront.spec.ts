import { describe, expect, it } from 'vitest';
import {
  categoryLabel,
  filterProducts,
  lowestPrice,
  orderVariantsByPrice,
  sortProducts,
  stockLevel,
  type StoreProduct,
} from './storefront';

const variant = (variantId: string, amount: string, available = 10) => ({
  variantId,
  sku: variantId,
  displayName: variantId,
  price: { amount, currency: 'VND' },
  available,
});
const product = (id: string, name: string, category: string, amounts: string[]): StoreProduct => ({
  id,
  name,
  description: '',
  category,
  imagePath: null,
  imageAlt: null,
  variants: amounts.map((a, i) => variant(`${id}-${i}`, a)),
});
const catalog = [
  product('a', 'Sữa Rửa Mặt CeraVe', 'cleansing', ['190000']),
  product('b', 'Serum Phục Hồi Hyalu B5', 'serum', ['1050000', '590000']),
  product('c', 'Dầu Gội Dove', 'hair', ['135000']),
];

describe('storefront', () => {
  it('should label known categories in Vietnamese and pass unknown ones through', () => {
    // act
    const labels = [categoryLabel('sunscreen'), categoryLabel('mystery')];
    // assert
    expect(labels).toEqual(['Chống nắng', 'mystery']);
  });
  it('should match queries without Vietnamese diacritics', () => {
    // act
    const found = filterProducts(catalog, { query: 'sua rua mat', category: 'all' });
    // assert
    expect(found.map((p) => p.id)).toEqual(['a']);
  });
  it('should filter by category', () => {
    // act
    const found = filterProducts(catalog, { query: '', category: 'hair' });
    // assert
    expect(found.map((p) => p.id)).toEqual(['c']);
  });
  it('should find the lowest variant price by integer value, not by string order', () => {
    // act
    const lowest = lowestPrice(catalog[1]!);
    // assert
    expect(lowest).toBe(590000n);
  });
  it('should sort by lowest price ascending and descending without mutating input', () => {
    // arrange
    const before = catalog.map((p) => p.id);
    // act
    const asc = sortProducts(catalog, 'price-asc').map((p) => p.id);
    const desc = sortProducts(catalog, 'price-desc').map((p) => p.id);
    // assert
    expect(asc).toEqual(['c', 'a', 'b']);
    expect(desc).toEqual(['b', 'a', 'c']);
    expect(catalog.map((p) => p.id)).toEqual(before);
  });
  it('should keep catalog order for the featured sort', () => {
    // act
    const featured = sortProducts(catalog, 'featured').map((p) => p.id);
    // assert
    expect(featured).toEqual(['a', 'b', 'c']);
  });
  it("should order each product's variants from cheapest to priciest without mutating input", () => {
    // arrange
    const before = catalog[1]!.variants.map((v) => v.variantId);
    // act
    const [ordered] = orderVariantsByPrice([catalog[1]!]);
    // assert
    expect(ordered!.variants.map((v) => v.price.amount)).toEqual(['590000', '1050000']);
    expect(catalog[1]!.variants.map((v) => v.variantId)).toEqual(before);
  });
  it('should classify stock as out, low or in', () => {
    // act
    const levels = [0, 10, 11].map((n) => stockLevel(variant('v', '1', n)));
    // assert
    expect(levels).toEqual(['out', 'low', 'in']);
  });
});
