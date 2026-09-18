import { DomainError } from '../../shared/domain/domain-error';
import { requireNonBlank } from '../../shared/domain/guards';
import { Money } from '../../shared/domain/money';
import { QuoteLine } from './quote-line';

export interface DiscountContext {
  readonly customerId: string;
  readonly lines: readonly QuoteLine[];
  readonly itemsTotal: Money;
}

/**
 * Protected Variations: thêm chương trình giảm giá mới = thêm một cài đặt của
 * interface này, **không** sửa `Order` cũng không sửa `QuoteLine.subtotal()`.
 *
 * Hợp đồng: chính sách chỉ *trả về* số tiền giảm, không bao giờ sửa giỏ.
 * Giá trị trả về luôn `>= 0` và luôn `<= context.itemsTotal`.
 */
export interface DiscountPolicy {
  readonly code: string;
  discountFor(context: DiscountContext): Money;
}

export interface ThresholdDiscountProps {
  readonly code: string;
  readonly minimumSpend: Money;
  readonly discount: Money;
}

/** Bước "ngưỡng": tiêu đủ `minimumSpend` thì được trừ thẳng `discount`. */
export class ThresholdDiscountPolicy implements DiscountPolicy {
  readonly code: string;
  readonly #minimumSpend: Money;
  readonly #discount: Money;

  private constructor(code: string, minimumSpend: Money, discount: Money) {
    this.code = code;
    this.#minimumSpend = minimumSpend;
    this.#discount = discount;
  }

  static create(props: ThresholdDiscountProps): ThresholdDiscountPolicy {
    const code = requireNonBlank(props.code, 'code', 'INVALID_DISCOUNT_POLICY');

    if (props.minimumSpend.isNegative() || props.discount.isNegative()) {
      throw new DomainError('INVALID_DISCOUNT_POLICY', 'Ngưỡng và mức giảm không được âm', {
        code,
        minimumSpend: props.minimumSpend.toString(),
        discount: props.discount.toString(),
      });
    }

    return new ThresholdDiscountPolicy(code, props.minimumSpend, props.discount);
  }

  discountFor(context: DiscountContext): Money {
    if (context.itemsTotal.compareTo(this.#minimumSpend) < 0) {
      return Money.zero(context.itemsTotal.currency);
    }
    // Tự chặn trần tại giỏ: một chính sách đơn lẻ cũng không được đẩy tổng về âm.
    return this.#discount.min(context.itemsTotal);
  }
}

export interface PercentageDiscountProps {
  readonly code: string;
  readonly basisPoints: number;
  readonly cap?: Money | null;
  readonly minimumSpend?: Money;
}

/**
 * Bước "phần trăm → làm tròn → trần".
 *
 * Tỷ lệ tính bằng điểm cơ bản (1250 = 12.5%) để không có số thực nào chạm vào
 * tiền; việc làm tròn half-up nằm trong `Money.percentage`. `cap` là bước "trần"
 * tuỳ chọn — chương trình kiểu "giảm 15%, tối đa 100k".
 */
export class PercentageDiscountPolicy implements DiscountPolicy {
  readonly code: string;
  readonly #basisPoints: number;
  readonly #cap: Money | null;
  readonly #minimumSpend: Money | undefined;

  private constructor(code: string, basisPoints: number, cap: Money | null, minimumSpend?: Money) {
    this.code = code;
    this.#basisPoints = basisPoints;
    this.#cap = cap;
    this.#minimumSpend = minimumSpend;
  }

  static create(props: PercentageDiscountProps): PercentageDiscountPolicy {
    const code = requireNonBlank(props.code, 'code', 'INVALID_DISCOUNT_POLICY');

    if (!Number.isSafeInteger(props.basisPoints) || props.basisPoints < 0) {
      throw new DomainError(
        'INVALID_DISCOUNT_POLICY',
        'Tỷ lệ giảm phải là số nguyên điểm cơ bản không âm',
        { code, basisPoints: props.basisPoints },
      );
    }

    const cap = props.cap ?? null;
    if (cap !== null && cap.isNegative()) {
      throw new DomainError('INVALID_DISCOUNT_POLICY', 'Trần giảm giá không được âm', {
        code,
        cap: cap.toString(),
      });
    }

    if (props.minimumSpend?.isNegative()) {
      throw new DomainError('INVALID_DISCOUNT_POLICY', 'Ngưỡng giảm giá không được âm');
    }

    return new PercentageDiscountPolicy(code, props.basisPoints, cap, props.minimumSpend);
  }

  discountFor(context: DiscountContext): Money {
    if (this.#minimumSpend && context.itemsTotal.compareTo(this.#minimumSpend) < 0) {
      return Money.zero(context.itemsTotal.currency);
    }
    const share = context.itemsTotal.percentage(this.#basisPoints);
    const capped = this.#cap === null ? share : share.min(this.#cap);
    return capped.min(context.itemsTotal);
  }
}

/**
 * Chuỗi chính sách chạy đúng thứ tự đã soạn: ngưỡng → phần trăm → làm tròn →
 * trần → `min(base)`.
 *
 * Mỗi chính sách thành viên nhìn **cùng một** giỏ gốc, không nhìn giỏ đã bị
 * thành viên trước bào mòn — nhờ vậy thứ tự soạn không đổi con số của từng
 * chương trình, và bước duy nhất phụ thuộc thứ tự là bước cuối: chặn tổng giảm
 * tại `itemsTotal` để tổng phải trả không bao giờ âm.
 */
export class CompositeDiscountPolicy implements DiscountPolicy {
  readonly code: string;
  readonly #policies: readonly DiscountPolicy[];

  private constructor(code: string, policies: readonly DiscountPolicy[]) {
    this.code = code;
    this.#policies = policies;
  }

  static of(code: string, policies: readonly DiscountPolicy[]): CompositeDiscountPolicy {
    const trimmed = requireNonBlank(code, 'code', 'INVALID_DISCOUNT_POLICY');
    return new CompositeDiscountPolicy(trimmed, Object.freeze([...policies]));
  }

  discountFor(context: DiscountContext): Money {
    const total = this.#policies.reduce((accumulated, policy) => {
      const granted = policy.discountFor(context);
      if (granted.isNegative()) {
        // Vi phạm hợp đồng của interface → lỗi lập trình, không phải tình huống nghiệp vụ.
        throw new DomainError('INVALID_DISCOUNT', 'Chính sách giảm giá trả về số âm', {
          policy: policy.code,
          granted: granted.toString(),
        });
      }
      return accumulated.add(granted);
    }, Money.zero(context.itemsTotal.currency));

    return total.min(context.itemsTotal);
  }
}
