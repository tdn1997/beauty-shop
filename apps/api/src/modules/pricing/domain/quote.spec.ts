import { describe, expect, it } from 'vitest';

import { DomainError } from '../../shared/domain/domain-error';
import { Money } from '../../shared/domain/money';
import { Quote } from './quote';
import { QuoteLine } from './quote-line';

function serum(quantity = 2): QuoteLine {
  return QuoteLine.create({
    variantId: 'var_1',
    sku: 'SRM-VTC-30',
    nameSnapshot: 'Serum Vitamin C 30ml',
    unitPrice: Money.parse('459000', 'VND'),
    quantity,
  });
}

function cream(quantity = 1): QuoteLine {
  return QuoteLine.create({
    variantId: 'var_2',
    sku: 'CRM-NGT-50',
    nameSnapshot: 'Kem dưỡng đêm 50ml',
    unitPrice: Money.parse('82000', 'VND'),
    quantity,
  });
}

function quoteOf(overrides: Partial<Parameters<typeof Quote.for>[0]> = {}) {
  return Quote.for({
    customerId: 'cus_1',
    currency: 'VND',
    province: 'TP. Hồ Chí Minh',
    lines: [serum(), cream()],
    discount: Money.parse('50000', 'VND'),
    shippingFee: Money.parse('30000', 'VND'),
    ...overrides,
  });
}

describe('Quote - derived totals', () => {
  it('should add up the subtotals of its own lines', () => {
    // arrange
    const quote = quoteOf();

    // confirm
    expect(quote.lines).toHaveLength(2);

    // act
    const itemsTotal = quote.itemsTotal();

    // assert
    expect(itemsTotal.toString()).toBe('1000000 VND');
  });

  it('should expose the discount and shipping it was quoted with', () => {
    // arrange
    const quote = quoteOf();

    // confirm
    expect(quote.itemsTotal().toString()).toBe('1000000 VND');

    // act
    const amounts = [quote.discountTotal().toString(), quote.shippingFee().toString()];

    // assert
    expect(amounts).toEqual(['50000 VND', '30000 VND']);
  });

  it('should compute the grand total as items minus discount plus shipping', () => {
    // arrange
    const quote = quoteOf();

    // confirm
    expect(quote.itemsTotal().toString()).toBe('1000000 VND');

    // act
    const grandTotal = quote.grandTotal();

    // assert
    expect(grandTotal.toString()).toBe('980000 VND');
  });

  it('should reach exactly the shipping fee when the discount eats the whole basket', () => {
    // arrange
    const quote = quoteOf({ discount: Money.parse('1000000', 'VND') });

    // confirm
    expect(quote.discountTotal().equals(quote.itemsTotal())).toBe(true);

    // act
    const grandTotal = quote.grandTotal();

    // assert
    expect(grandTotal.toString()).toBe('30000 VND');
    expect(grandTotal.isNegative()).toBe(false);
  });
});

describe('Quote - invariants', () => {
  it('should refuse a line quoted in another currency', () => {
    // arrange
    const foreign = QuoteLine.create({
      variantId: 'var_3',
      sku: 'MSK-HYD-01',
      nameSnapshot: 'Mặt nạ cấp ẩm',
      unitPrice: Money.parse('5.00', 'USD'),
      quantity: 1,
    });
    const lines = [serum(), foreign];

    // confirm
    expect(() => quoteOf()).not.toThrow();

    // act
    const act = () => quoteOf({ lines });

    // assert
    expect(act).toThrow(DomainError);
    expect(act).toThrow(/CURRENCY_MISMATCH/);
    expect(lines.map((line) => line.quantity)).toEqual([2, 1]);
  });

  it('should refuse a discount larger than the basket', () => {
    // arrange
    const discount = Money.parse('1000001', 'VND');

    // confirm
    expect(() => quoteOf()).not.toThrow();

    // act
    const act = () => quoteOf({ discount });

    // assert
    expect(act).toThrow(/EXCESSIVE_DISCOUNT/);
    expect(discount.toString()).toBe('1000001 VND');
  });

  it('should refuse a negative discount', () => {
    // arrange
    const discount = Money.parse('-1', 'VND');

    // confirm
    expect(discount.isNegative()).toBe(true);

    // act
    const act = () => quoteOf({ discount });

    // assert
    expect(act).toThrow(/INVALID_DISCOUNT/);
  });

  it('should refuse a negative shipping fee', () => {
    // arrange
    const shippingFee = Money.parse('-1', 'VND');

    // confirm
    expect(shippingFee.isNegative()).toBe(true);

    // act
    const act = () => quoteOf({ shippingFee });

    // assert
    expect(act).toThrow(/INVALID_SHIPPING_FEE/);
  });

  it('should refuse a quote without any line', () => {
    // arrange
    const lines: QuoteLine[] = [];

    // confirm
    expect(lines).toHaveLength(0);

    // act
    const act = () => quoteOf({ lines, discount: Money.zero('VND') });

    // assert
    expect(act).toThrow(/EMPTY_QUOTE/);
  });

  it('should refuse a blank customerId', () => {
    // arrange
    const customerId = '  ';

    // confirm
    expect(() => quoteOf()).not.toThrow();

    // act
    const act = () => quoteOf({ customerId });

    // assert
    expect(act).toThrow(/INVALID_QUOTE/);
  });

  it('should refuse a blank province', () => {
    // arrange
    const province = '';

    // confirm
    expect(() => quoteOf()).not.toThrow();

    // act
    const act = () => quoteOf({ province });

    // assert
    expect(act).toThrow(/INVALID_QUOTE/);
  });
});

describe('Quote - encapsulation', () => {
  it('should hand back a frozen copy of its lines', () => {
    // arrange
    const quote = quoteOf();

    // confirm
    expect(quote.lines).toHaveLength(2);

    // act
    const lines = quote.lines;

    // assert
    expect(Object.isFrozen(lines)).toBe(true);
    expect(() => (lines as QuoteLine[]).push(cream())).toThrow();
    expect(quote.lines).toHaveLength(2);
  });

  it('should not track the array it was constructed from', () => {
    // arrange
    const lines = [serum(), cream()];
    const quote = quoteOf({ lines });

    // confirm
    expect(quote.lines).toHaveLength(2);

    // act
    lines.push(cream(5));

    // assert
    expect(quote.lines).toHaveLength(2);
    expect(quote.itemsTotal().toString()).toBe('1000000 VND');
  });

  it('should not expose any writable field', () => {
    // arrange
    const quote = quoteOf();

    // confirm
    expect(quote.customerId).toBe('cus_1');

    // act
    const ownKeys = Object.keys(quote);

    // assert
    expect(ownKeys).toEqual([]);
  });
});

describe('Quote - transport shape', () => {
  it('should serialise to plain data with money as transport shapes', () => {
    // arrange
    const quote = quoteOf();

    // confirm
    expect(quote.grandTotal().toString()).toBe('980000 VND');

    // act
    const dto = quote.toDto();

    // assert
    expect(dto).toEqual({
      customerId: 'cus_1',
      currency: 'VND',
      province: 'TP. Hồ Chí Minh',
      lines: [
        {
          variantId: 'var_1',
          sku: 'SRM-VTC-30',
          nameSnapshot: 'Serum Vitamin C 30ml',
          unitPrice: { amount: '459000', currency: 'VND' },
          quantity: 2,
          subtotal: { amount: '918000', currency: 'VND' },
        },
        {
          variantId: 'var_2',
          sku: 'CRM-NGT-50',
          nameSnapshot: 'Kem dưỡng đêm 50ml',
          unitPrice: { amount: '82000', currency: 'VND' },
          quantity: 1,
          subtotal: { amount: '82000', currency: 'VND' },
        },
      ],
      itemsTotal: { amount: '1000000', currency: 'VND' },
      discountTotal: { amount: '50000', currency: 'VND' },
      shippingFee: { amount: '30000', currency: 'VND' },
      grandTotal: { amount: '980000', currency: 'VND' },
    });
  });

  it('should serialise the same shape through JSON', () => {
    // arrange
    const quote = quoteOf();

    // confirm
    expect(quote.toDto().grandTotal).toEqual({ amount: '980000', currency: 'VND' });

    // act
    const json = JSON.parse(JSON.stringify(quote));

    // assert
    expect(json).toEqual(quote.toDto());
  });
});
