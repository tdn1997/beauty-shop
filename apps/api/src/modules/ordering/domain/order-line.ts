import { DomainError } from '../../shared/domain/domain-error';
import { requireNonBlank, requirePositiveInteger } from '../../shared/domain/guards';
import { Money } from '../../shared/domain/money';

export interface CreateOrderLineProps {
  readonly variantId: string;
  readonly sku: string;
  readonly nameSnapshot: string;
  readonly unitPriceSnapshot: Money;
  readonly quantity: number;
}

/**
 * Một dòng trong đơn hàng.
 *
 * `unitPriceSnapshot` và `nameSnapshot` là **bản chụp** tại thời điểm đặt hàng,
 * không tham chiếu catalog: catalog đổi giá thì đơn cũ không được đổi theo.
 * `subtotal()` là giá trị suy dẫn — tính bằng method, không lưu thành cột.
 */
export class OrderLine {
  readonly #variantId: string;
  readonly #sku: string;
  readonly #nameSnapshot: string;
  readonly #unitPriceSnapshot: Money;
  #quantity: number;

  private constructor(props: {
    variantId: string;
    sku: string;
    nameSnapshot: string;
    unitPriceSnapshot: Money;
    quantity: number;
  }) {
    this.#variantId = props.variantId;
    this.#sku = props.sku;
    this.#nameSnapshot = props.nameSnapshot;
    this.#unitPriceSnapshot = props.unitPriceSnapshot;
    this.#quantity = props.quantity;
  }

  static create(props: CreateOrderLineProps): OrderLine {
    const variantId = requireNonBlank(props.variantId, 'variantId', 'INVALID_ORDER_LINE');
    const sku = requireNonBlank(props.sku, 'sku', 'INVALID_ORDER_LINE');
    const nameSnapshot = requireNonBlank(props.nameSnapshot, 'nameSnapshot', 'INVALID_ORDER_LINE');
    const quantity = requirePositiveInteger(props.quantity, 'quantity', 'INVALID_QUANTITY');

    if (props.unitPriceSnapshot.isNegative()) {
      throw new DomainError('INVALID_UNIT_PRICE', 'Đơn giá không được âm', {
        unitPrice: props.unitPriceSnapshot.toString(),
      });
    }

    return new OrderLine({
      variantId,
      sku,
      nameSnapshot,
      unitPriceSnapshot: props.unitPriceSnapshot,
      quantity,
    });
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

  get unitPriceSnapshot(): Money {
    return this.#unitPriceSnapshot;
  }

  get quantity(): number {
    return this.#quantity;
  }

  changeQuantity(quantity: number): void {
    this.#quantity = requirePositiveInteger(quantity, 'quantity', 'INVALID_QUANTITY');
  }

  /** Information Expert: dòng đơn tự tính thành tiền của chính nó. */
  subtotal(): Money {
    return this.#unitPriceSnapshot.times(this.#quantity);
  }
}
