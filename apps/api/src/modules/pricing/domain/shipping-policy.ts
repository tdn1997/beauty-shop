import { DomainError } from '../../shared/domain/domain-error';
import { requireNonBlank } from '../../shared/domain/guards';
import { Money } from '../../shared/domain/money';

export interface ShippingContext {
  readonly itemsTotal: Money;
  readonly province: string;
  readonly totalQuantity: number;
}

/**
 * Protected Variations cho phí giao hàng: đổi bảng cước, thêm vùng, thêm
 * chương trình miễn phí — tất cả là cài đặt mới của interface này.
 *
 * Hợp đồng: chính sách chỉ *trả về* phí, không sửa đơn hàng. Phí luôn `>= 0`.
 */
export interface ShippingPolicy {
  readonly code: string;
  feeFor(context: ShippingContext): Money;
}

export interface FlatRateShippingProps {
  readonly code: string;
  readonly fee: Money;
}

/** Cước phẳng: một mức cho mọi giỏ. Nền để các chính sách khác bọc lên. */
export class FlatRateShippingPolicy implements ShippingPolicy {
  readonly code: string;
  readonly #fee: Money;

  private constructor(code: string, fee: Money) {
    this.code = code;
    this.#fee = fee;
  }

  static create(props: FlatRateShippingProps): FlatRateShippingPolicy {
    const code = requireNonBlank(props.code, 'code', 'INVALID_SHIPPING_POLICY');

    if (props.fee.isNegative()) {
      throw new DomainError('INVALID_SHIPPING_POLICY', 'Cước vận chuyển không được âm', {
        code,
        fee: props.fee.toString(),
      });
    }

    return new FlatRateShippingPolicy(code, props.fee);
  }

  feeFor(_context: ShippingContext): Money {
    return this.#fee;
  }
}

export interface FreeOverThresholdShippingProps {
  readonly code: string;
  readonly threshold: Money;
  readonly base: ShippingPolicy;
}

/**
 * Miễn cước từ một ngưỡng giỏ trở lên, dưới ngưỡng thì **uỷ quyền** cho chính
 * sách nền.
 *
 * Bọc thay vì kế thừa: thêm chương trình "freeship" không đụng tới bảng cước
 * bên dưới, cũng không đụng tới `Order` — đúng câu hỏi số 6 trong checklist
 * review PR ("thêm nhà cung cấp mới có phải sửa `Order` không?").
 */
export class FreeOverThresholdShippingPolicy implements ShippingPolicy {
  readonly code: string;
  readonly #threshold: Money;
  readonly #base: ShippingPolicy;

  private constructor(code: string, threshold: Money, base: ShippingPolicy) {
    this.code = code;
    this.#threshold = threshold;
    this.#base = base;
  }

  static create(props: FreeOverThresholdShippingProps): FreeOverThresholdShippingPolicy {
    const code = requireNonBlank(props.code, 'code', 'INVALID_SHIPPING_POLICY');

    if (props.threshold.isNegative()) {
      throw new DomainError('INVALID_SHIPPING_POLICY', 'Ngưỡng miễn cước không được âm', {
        code,
        threshold: props.threshold.toString(),
      });
    }

    return new FreeOverThresholdShippingPolicy(code, props.threshold, props.base);
  }

  feeFor(context: ShippingContext): Money {
    if (context.itemsTotal.compareTo(this.#threshold) >= 0) {
      return Money.zero(context.itemsTotal.currency);
    }

    const fee = this.#base.feeFor(context);
    if (fee.isNegative()) {
      // Vi phạm hợp đồng của interface → lỗi lập trình.
      throw new DomainError('INVALID_SHIPPING_FEE', 'Chính sách nền trả về cước âm', {
        policy: this.#base.code,
        fee: fee.toString(),
      });
    }
    return fee;
  }
}
