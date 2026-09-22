export interface CatalogVariantDto {
  variantId: string;
  sku: string;
  displayName: string;
  price: { amount: string; currency: string };
  available: number;
}

export interface CatalogProductDto {
  id: string;
  name: string;
  description: string;
  category: string;
  imagePath: string | null;
  imageAlt: string | null;
  variants: CatalogVariantDto[];
}

export interface CatalogReader {
  listPublic(now: Date): Promise<CatalogProductDto[]>;
}

/**
 * Token thời gian chạy cho `CatalogReader`. Interface TypeScript biến mất
 * sau khi biên dịch nên Nest không có gì để phân giải — mọi nơi inject
 * `CatalogReader` phải dùng `@Inject(CATALOG_READER)` với token này.
 */
export const CATALOG_READER = Symbol('CatalogReader');
