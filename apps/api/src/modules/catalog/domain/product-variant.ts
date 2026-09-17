import { DomainError } from '../../shared/domain/domain-error';
import { requireNonBlank } from '../../shared/domain/guards';
import { Money } from '../../shared/domain/money';

export enum VariantStatus {
  Active = 'ACTIVE',
  Discontinued = 'DISCONTINUED',
}

export interface CreateVariantProps {
  readonly id: string;
  readonly productId: string;
  readonly sku: string;
  readonly name: string;
  readonly listPrice: Money;
}

/**
 * Biến thể bán được (dung tích / tông màu). `sku` là định danh nghiệp vụ —
 * readonly, chuẩn hoá hoa ngay khi tạo để không có hai SKU chỉ khác chữ hoa thường.
 */
export class ProductVariant {
  readonly #id: string;
  readonly #productId: string;
  readonly #sku: string;
  #name: string;
  #listPrice: Money;
  #status: VariantStatus;

  private constructor(props: {
    id: string;
    productId: string;
    sku: string;
    name: string;
    listPrice: Money;
  }) {
    this.#id = props.id;
    this.#productId = props.productId;
    this.#sku = props.sku;
    this.#name = props.name;
    this.#listPrice = props.listPrice;
    this.#status = VariantStatus.Active;
  }

  static create(props: CreateVariantProps): ProductVariant {
    const id = requireNonBlank(props.id, 'id', 'INVALID_VARIANT');
    const productId = requireNonBlank(props.productId, 'productId', 'INVALID_VARIANT');
    const sku = requireNonBlank(props.sku, 'sku', 'INVALID_VARIANT').toUpperCase();
    const name = requireNonBlank(props.name, 'name', 'INVALID_VARIANT');
    requireSellablePrice(props.listPrice);

    return new ProductVariant({ id, productId, sku, name, listPrice: props.listPrice });
  }

  get id(): string {
    return this.#id;
  }

  get productId(): string {
    return this.#productId;
  }

  get sku(): string {
    return this.#sku;
  }

  get name(): string {
    return this.#name;
  }

  get listPrice(): Money {
    return this.#listPrice;
  }

  get status(): VariantStatus {
    return this.#status;
  }

  changeListPrice(price: Money): void {
    if (price.currency !== this.#listPrice.currency) {
      throw new DomainError(
        'CURRENCY_MISMATCH',
        `Biến thể niêm yết bằng ${this.#listPrice.currency}, không nhận ${price.currency}`,
        { expected: this.#listPrice.currency, received: price.currency },
      );
    }
    requireSellablePrice(price);
    this.#listPrice = price;
  }

  discontinue(): void {
    this.#status = VariantStatus.Discontinued;
  }

  isSellable(): boolean {
    return this.#status === VariantStatus.Active;
  }
}

function requireSellablePrice(price: Money): void {
  if (price.isNegative()) {
    throw new DomainError('INVALID_VARIANT', 'Giá niêm yết không được âm', {
      price: price.toString(),
    });
  }
}
