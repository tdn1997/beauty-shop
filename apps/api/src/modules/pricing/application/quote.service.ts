import { DomainError } from '../../shared/domain/domain-error';
import { requirePositiveInteger } from '../../shared/domain/guards';
import { CurrencyCode, Money } from '../../shared/domain/money';
import { Result } from '../../shared/domain/result';
import { DiscountPolicy } from '../domain/discount-policy';
import { Quote } from '../domain/quote';
import { QuoteLine } from '../domain/quote-line';
import { ShippingPolicy } from '../domain/shipping-policy';
import { PriceCatalog, PricedVariant } from './price-catalog';

export interface QuoteLineRequest {
  readonly variantId: string;
  readonly quantity: number;
}

export interface QuoteRequest {
  readonly customerId: string;
  readonly currency: CurrencyCode;
  readonly province: string;
  readonly lines: readonly QuoteLineRequest[];
}

/**
 * Ca sử dụng báo giá — phía TRUY VẤN: đọc giá, tính, trả về. Không ghi gì cả,
 * kể cả một dòng log trạng thái, nên gọi bao nhiêu lần cũng ra cùng kết quả.
 *
 * Chính sách giảm giá và phí ship được **inject**: thêm chương trình mới là
 * cắm cài đặt khác ở composition root, service này không đổi một dòng nào
 * (Protected Variations).
 *
 * Giỏ rỗng / không có biến thể / biến thể ngừng bán / lệch tiền tệ là tình
 * huống nghiệp vụ đã lường trước → `Result.err`. Lượng đặt `<= 0` là lỗi lập
 * trình (tầng gọi phải chặn từ đầu) → để guard `throw`. Lỗi hạ tầng của catalog
 * được để nổi lên nguyên vẹn.
 */
export class QuoteService {
  readonly #catalog: PriceCatalog;
  readonly #discounts: DiscountPolicy;
  readonly #shipping: ShippingPolicy;

  constructor(catalog: PriceCatalog, discounts: DiscountPolicy, shipping: ShippingPolicy) {
    this.#catalog = catalog;
    this.#discounts = discounts;
    this.#shipping = shipping;
  }

  async quoteFor(request: QuoteRequest): Promise<Result<Quote>> {
    for (const line of request.lines) {
      requirePositiveInteger(line.quantity, 'quantity', 'INVALID_QUANTITY');
    }

    if (request.lines.length === 0) {
      return Result.err(
        new DomainError('EMPTY_BASKET', 'Giỏ hàng trống thì không có gì để báo giá', {
          customerId: request.customerId,
        }),
      );
    }

    const lines: QuoteLine[] = [];
    for (const requested of request.lines) {
      const variant = await this.#catalog.findVariant(requested.variantId);
      const rejection = this.#rejectionFor(requested.variantId, variant, request.currency);
      if (rejection) return Result.err(rejection);

      lines.push(
        QuoteLine.create({
          variantId: variant!.variantId,
          sku: variant!.sku,
          nameSnapshot: variant!.name,
          unitPrice: variant!.unitPrice,
          quantity: requested.quantity,
        }),
      );
    }

    const itemsTotal = lines.reduce(
      (total, line) => total.add(line.subtotal()),
      Money.zero(request.currency),
    );

    const discount = this.#discounts.discountFor({
      customerId: request.customerId,
      lines: Object.freeze([...lines]),
      itemsTotal,
    });

    const shippingFee = this.#shipping.feeFor({
      itemsTotal,
      province: request.province,
      totalQuantity: lines.reduce((count, line) => count + line.quantity, 0),
    });

    return Result.ok(
      Quote.for({
        customerId: request.customerId,
        currency: request.currency,
        province: request.province,
        lines,
        discount,
        shippingFee,
      }),
    );
  }

  /** Lý do từ chối một dòng, hoặc `null` nếu dòng đó báo giá được. */
  #rejectionFor(
    variantId: string,
    variant: PricedVariant | null,
    currency: CurrencyCode,
  ): DomainError | null {
    if (!variant) {
      return new DomainError('VARIANT_NOT_FOUND', `Không tìm thấy biến thể ${variantId}`, {
        variantId,
      });
    }
    if (!variant.sellable) {
      return new DomainError('VARIANT_NOT_SELLABLE', `Biến thể ${variantId} đã ngừng bán`, {
        variantId,
      });
    }
    if (variant.unitPrice.currency !== currency) {
      return new DomainError(
        'CURRENCY_MISMATCH',
        `Biến thể ${variantId} niêm yết bằng ${variant.unitPrice.currency}, không phải ${currency}`,
        { variantId, expected: currency, received: variant.unitPrice.currency },
      );
    }
    return null;
  }
}
