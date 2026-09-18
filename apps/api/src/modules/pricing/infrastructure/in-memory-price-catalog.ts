import { PriceCatalog, PricedVariant } from '../application/price-catalog';

/**
 * Bảng giá nằm trong bộ nhớ — **nợ kỹ thuật có chủ ý**, nói thẳng ra ở đây.
 *
 * Schema Prisma hiện chưa có bảng `product_variant`, nên chưa có gì để đọc
 * giá lên. Thay vì bịa ra một bảng chỉ để việc báo giá chạy được, cổng
 * `PriceCatalog` được cắm bằng cài đặt này: giá nạp qua constructor, không lưu
 * xuống đâu cả, mất khi tiến trình dừng.
 *
 * Khi bảng `product_variant` có thật, `PrismaPriceCatalog` thay chỗ lớp này ở
 * composition root và `QuoteService` **không đổi một dòng nào** — đó chính là
 * lý do cổng tồn tại.
 */
export class InMemoryPriceCatalog implements PriceCatalog {
  readonly #variants: ReadonlyMap<string, PricedVariant>;

  constructor(variants: readonly PricedVariant[] = []) {
    this.#variants = new Map(variants.map((variant) => [variant.variantId, variant]));
  }

  async findVariant(variantId: string): Promise<PricedVariant | null> {
    return this.#variants.get(variantId) ?? null;
  }
}
