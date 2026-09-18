import { DomainError } from '../../shared/domain/domain-error';
import { requireNonBlank } from '../../shared/domain/guards';
import { CurrencyCode, Money, MoneyDto } from '../../shared/domain/money';
import { QuoteLine } from './quote-line';

export interface QuoteProps {
  readonly customerId: string;
  readonly currency: CurrencyCode;
  readonly province: string;
  readonly lines: readonly QuoteLine[];
  readonly discount: Money;
  readonly shippingFee: Money;
}

export interface QuoteLineDto {
  readonly variantId: string;
  readonly sku: string;
  readonly nameSnapshot: string;
  readonly unitPrice: MoneyDto;
  readonly quantity: number;
  readonly subtotal: MoneyDto;
}

export interface QuoteDto {
  readonly customerId: string;
  readonly currency: CurrencyCode;
  readonly province: string;
  readonly lines: readonly QuoteLineDto[];
  readonly itemsTotal: MoneyDto;
  readonly discountTotal: MoneyDto;
  readonly shippingFee: MoneyDto;
  readonly grandTotal: MoneyDto;
}

/**
 * Báo giá đã chốt số: value object bất biến, không có trạng thái để đổi.
 *
 * Mọi con số tổng đều là **method suy dẫn** chứ không phải cột lưu sẵn — có
 * đúng một công thức cho mỗi tổng, nên không có chỗ nào để hai công thức lệch
 * nhau. Chính sách giảm giá / phí ship đã chạy xong ở ngoài; `Quote` chỉ nhận
 * kết quả và canh các bất biến: cùng tiền tệ, giảm không vượt giỏ, tổng phải
 * trả không âm.
 */
export class Quote {
  readonly #customerId: string;
  readonly #currency: CurrencyCode;
  readonly #province: string;
  readonly #lines: readonly QuoteLine[];
  readonly #discount: Money;
  readonly #shippingFee: Money;

  private constructor(props: {
    customerId: string;
    currency: CurrencyCode;
    province: string;
    lines: readonly QuoteLine[];
    discount: Money;
    shippingFee: Money;
  }) {
    this.#customerId = props.customerId;
    this.#currency = props.currency;
    this.#province = props.province;
    this.#lines = props.lines;
    this.#discount = props.discount;
    this.#shippingFee = props.shippingFee;
  }

  static for(props: QuoteProps): Quote {
    const customerId = requireNonBlank(props.customerId, 'customerId', 'INVALID_QUOTE');
    const province = requireNonBlank(props.province, 'province', 'INVALID_QUOTE');

    if (props.lines.length === 0) {
      throw new DomainError('EMPTY_QUOTE', 'Báo giá phải có ít nhất một dòng', { customerId });
    }

    for (const line of props.lines) {
      Quote.#requireCurrency(line.unitPrice, props.currency, `dòng ${line.sku}`);
    }
    Quote.#requireCurrency(props.discount, props.currency, 'mức giảm');
    Quote.#requireCurrency(props.shippingFee, props.currency, 'phí vận chuyển');

    if (props.discount.isNegative()) {
      throw new DomainError('INVALID_DISCOUNT', 'Mức giảm không được âm', {
        discount: props.discount.toString(),
      });
    }
    if (props.shippingFee.isNegative()) {
      throw new DomainError('INVALID_SHIPPING_FEE', 'Phí vận chuyển không được âm', {
        shippingFee: props.shippingFee.toString(),
      });
    }

    // Bản chụp: mảng người gọi đưa vào có đổi sau này cũng không chạm tới báo giá.
    const lines = Object.freeze([...props.lines]);
    const itemsTotal = lines.reduce(
      (total, line) => total.add(line.subtotal()),
      Money.zero(props.currency),
    );

    if (props.discount.compareTo(itemsTotal) > 0) {
      throw new DomainError('EXCESSIVE_DISCOUNT', 'Mức giảm vượt quá tiền hàng', {
        discount: props.discount.toString(),
        itemsTotal: itemsTotal.toString(),
      });
    }

    return new Quote({
      customerId,
      currency: props.currency,
      province,
      lines,
      discount: props.discount,
      shippingFee: props.shippingFee,
    });
  }

  get customerId(): string {
    return this.#customerId;
  }

  get currency(): CurrencyCode {
    return this.#currency;
  }

  get province(): string {
    return this.#province;
  }

  /** Bản chụp đông cứng: người gọi không thêm/bớt dòng qua getter này. */
  get lines(): readonly QuoteLine[] {
    return Object.freeze([...this.#lines]);
  }

  /** Information Expert: báo giá tự cộng thành tiền từ các dòng của chính nó. */
  itemsTotal(): Money {
    return this.#lines.reduce(
      (total, line) => total.add(line.subtotal()),
      Money.zero(this.#currency),
    );
  }

  discountTotal(): Money {
    return this.#discount;
  }

  shippingFee(): Money {
    return this.#shippingFee;
  }

  /** Không bao giờ âm: bất biến `discount <= itemsTotal` được canh ở factory. */
  grandTotal(): Money {
    return this.itemsTotal().subtract(this.#discount).add(this.#shippingFee);
  }

  /** Dữ liệu thuần cho tầng trên: không rò rỉ đối tượng domain ra ngoài. */
  toDto(): QuoteDto {
    return {
      customerId: this.#customerId,
      currency: this.#currency,
      province: this.#province,
      lines: Object.freeze(
        this.#lines.map((line) => ({
          variantId: line.variantId,
          sku: line.sku,
          nameSnapshot: line.nameSnapshot,
          unitPrice: line.unitPrice.toJSON(),
          quantity: line.quantity,
          subtotal: line.subtotal().toJSON(),
        })),
      ),
      itemsTotal: this.itemsTotal().toJSON(),
      discountTotal: this.#discount.toJSON(),
      shippingFee: this.#shippingFee.toJSON(),
      grandTotal: this.grandTotal().toJSON(),
    };
  }

  toJSON(): QuoteDto {
    return this.toDto();
  }

  static #requireCurrency(amount: Money, expected: CurrencyCode, what: string): void {
    if (amount.currency !== expected) {
      throw new DomainError(
        'CURRENCY_MISMATCH',
        `Báo giá tính bằng ${expected}, không nhận ${amount.currency} ở ${what}`,
        { expected, received: amount.currency, what },
      );
    }
  }
}
