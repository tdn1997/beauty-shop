import { Money } from '../../shared/domain/money';

/**
 * Biến thể đã kèm giá — đúng phần mà việc báo giá cần, không hơn.
 *
 * Không phải entity của catalog: nếu cổng này trả về entity thật thì `pricing`
 * sẽ dính vào vòng đời của module `catalog`. Đây là dữ liệu thuần, đọc xong là
 * xong.
 */
export interface PricedVariant {
  readonly variantId: string;
  readonly sku: string;
  readonly name: string;
  readonly unitPrice: Money;
  readonly sellable: boolean;
}

/**
 * Cổng tra giá. Khai báo ở `application/` và được cài đặt ở `infrastructure/` —
 * ca sử dụng không biết giá nằm trong Postgres, trong bộ nhớ hay ở dịch vụ khác.
 */
export interface PriceCatalog {
  findVariant(variantId: string): Promise<PricedVariant | null>;
}
