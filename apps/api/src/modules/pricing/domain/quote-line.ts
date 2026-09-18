import { DomainError } from '../../shared/domain/domain-error';
import { requireNonBlank, requirePositiveInteger } from '../../shared/domain/guards';
import { Money } from '../../shared/domain/money';

export interface CreateQuoteLineProps {
  readonly variantId: string;
  readonly sku: string;
  readonly nameSnapshot: string;
  readonly unitPrice: Money;
  readonly quantity: number;
}

/**
 * Một dòng trong báo giá — value object bất biến.
 *
 * Tách khỏi `OrderLine` có chủ ý: báo giá là thứ *chưa* cam kết, nó được tính
 * lại mỗi lần khách xem giỏ; dòng đơn là bản chụp đã chốt. Gộp hai thứ này lại
 * sẽ khiến chính sách giá phải chạm vào aggregate đơn hàng.
 *
 * Information Expert: dòng tự nhân giá của chính nó với lượng của chính nó,
 * không để service ngoài làm hộ.
 */
export class QuoteLine {
  readonly #variantId: string;
  readonly #sku: string;
  readonly #nameSnapshot: string;
  readonly #unitPrice: Money;
  readonly #quantity: number;

  private constructor(props: {
    variantId: string;
    sku: string;
    nameSnapshot: string;
    unitPrice: Money;
    quantity: number;
  }) {
    this.#variantId = props.variantId;
    this.#sku = props.sku;
    this.#nameSnapshot = props.nameSnapshot;
    this.#unitPrice = props.unitPrice;
    this.#quantity = props.quantity;
  }

  static create(props: CreateQuoteLineProps): QuoteLine {
    const variantId = requireNonBlank(props.variantId, 'variantId', 'INVALID_QUOTE_LINE');
    const sku = requireNonBlank(props.sku, 'sku', 'INVALID_QUOTE_LINE');
    const nameSnapshot = requireNonBlank(props.nameSnapshot, 'nameSnapshot', 'INVALID_QUOTE_LINE');
    const quantity = requirePositiveInteger(props.quantity, 'quantity', 'INVALID_QUANTITY');

    if (props.unitPrice.isNegative()) {
      throw new DomainError('INVALID_UNIT_PRICE', 'Đơn giá không được âm', {
        unitPrice: props.unitPrice.toString(),
      });
    }

    return new QuoteLine({ variantId, sku, nameSnapshot, unitPrice: props.unitPrice, quantity });
  }

  get variantId(): string {
    return this.#variantId;
  }

  get sku(): string {
    return this.#sku;
  }

  get nameSnapshot(): string {
    return this.#nameSnapshot;
  }

  get unitPrice(): Money {
    return this.#unitPrice;
  }

  get quantity(): number {
    return this.#quantity;
  }

  /** Information Expert: dòng báo giá tự tính thành tiền của chính nó. */
  subtotal(): Money {
    return this.#unitPrice.times(this.#quantity);
  }
}
