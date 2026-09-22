import { describe, expect, it } from 'vitest';

import { DomainError } from '../../shared/domain/domain-error';
import { Money } from '../../shared/domain/money';
import {
  CompositeDiscountPolicy,
  DiscountContext,
  DiscountPolicy,
  PercentageDiscountPolicy,
  ThresholdDiscountPolicy,
} from './discount-policy';
import { QuoteLine } from './quote-line';

function line(unitPrice: string, quantity: number): QuoteLine {
  return QuoteLine.create({
    variantId: 'var_1',
    sku: 'SRM-VTC-30',
    nameSnapshot: 'Serum Vitamin C 30ml',
    unitPrice: Money.parse(unitPrice, 'VND'),
    quantity,
  });
}

function contextOf(
  itemsTotal: string,
  lines: readonly QuoteLine[] = [line('100000', 1)],
): DiscountContext {
  return {
    customerId: 'cus_1',
    lines,
    itemsTotal: Money.parse(itemsTotal, 'VND'),
  };
}

/** Chính sách giả rộng tay: dùng để ép chạm trần `min(base)` của composite. */
class GenerousPolicy implements DiscountPolicy {
  readonly code: string;
  readonly #amount: Money;

  constructor(code: string, amount: Money) {
    this.code = code;
    this.#amount = amount;
  }

  discountFor(): Money {
    return this.#amount;
  }
}

describe('ThresholdDiscountPolicy', () => {
  it('should give the flat discount once the basket reaches the threshold', () => {
    // arrange
    const policy = ThresholdDiscountPolicy.create({
      code: 'SPEND_500K_GET_50K',
      minimumSpend: Money.parse('500000', 'VND'),
      discount: Money.parse('50000', 'VND'),
    });

    // confirm
    expect(policy.code).toBe('SPEND_500K_GET_50K');

    // act
    const discount = policy.discountFor(contextOf('500000'));

    // assert
    expect(discount.toString()).toBe('50000 VND');
  });

  it('should give nothing below the threshold', () => {
    // arrange
    const policy = ThresholdDiscountPolicy.create({
      code: 'SPEND_500K_GET_50K',
      minimumSpend: Money.parse('500000', 'VND'),
      discount: Money.parse('50000', 'VND'),
    });

    // confirm
    expect(policy.discountFor(contextOf('500000')).toString()).toBe('50000 VND');

    // act
    const discount = policy.discountFor(contextOf('499999'));

    // assert
    expect(discount.equals(Money.zero('VND'))).toBe(true);
  });

  it('should never hand back more than the basket itself', () => {
    // arrange
    const policy = ThresholdDiscountPolicy.create({
      code: 'SPEND_100K_GET_200K',
      minimumSpend: Money.parse('100000', 'VND'),
      discount: Money.parse('200000', 'VND'),
    });

    // confirm
    expect(policy.discountFor(contextOf('300000')).toString()).toBe('200000 VND');

    // act
    const discount = policy.discountFor(contextOf('100000'));

    // assert
    expect(discount.toString()).toBe('100000 VND');
  });

  it('should reject a negative flat discount', () => {
    // arrange
    const props = {
      code: 'BAD',
      minimumSpend: Money.parse('100000', 'VND'),
      discount: Money.parse('-1', 'VND'),
    };

    // confirm
    expect(props.discount.isNegative()).toBe(true);

    // act
    const act = () => ThresholdDiscountPolicy.create(props);

    // assert
    expect(act).toThrow(DomainError);
    expect(act).toThrow(/INVALID_DISCOUNT_POLICY/);
  });

  it('should reject a blank code', () => {
    // arrange
    const props = {
      code: '  ',
      minimumSpend: Money.parse('100000', 'VND'),
      discount: Money.parse('50000', 'VND'),
    };

    // confirm
    expect(() => ThresholdDiscountPolicy.create({ ...props, code: 'OK' })).not.toThrow();

    // act
    const act = () => ThresholdDiscountPolicy.create(props);

    // assert
    expect(act).toThrow(/INVALID_DISCOUNT_POLICY/);
  });

  it('should refuse a basket in another currency', () => {
    // arrange
    const policy = ThresholdDiscountPolicy.create({
      code: 'SPEND_500K_GET_50K',
      minimumSpend: Money.parse('500000', 'VND'),
      discount: Money.parse('50000', 'VND'),
    });
    const foreign: DiscountContext = {
      customerId: 'cus_1',
      lines: [],
      itemsTotal: Money.parse('500.00', 'USD'),
    };

    // confirm
    expect(() => policy.discountFor(contextOf('500000'))).not.toThrow();

    // act
    const act = () => policy.discountFor(foreign);

    // assert
    expect(act).toThrow(/CURRENCY_MISMATCH/);
  });
});

describe('PercentageDiscountPolicy', () => {
  it.each([
    ['499999', 1000, '100000', '0'],
    ['500000', 1000, '100000', '50000'],
    ['500005', 1000, '100000', '50001'],
    ['2000000', 1000, '100000', '100000'],
    ['500000', 20000, '900000', '500000'],
  ])(
    'should apply threshold percent rounding cap and base limit for %s',
    (base, basisPoints, cap, expected) => {
      // arrange
      const policy = PercentageDiscountPolicy.create({
        code: 'THRESHOLD_PERCENT',
        minimumSpend: Money.parse('500000', 'VND'),
        basisPoints: Number(basisPoints),
        cap: Money.parse(cap, 'VND'),
      });
      const context = contextOf(base);
      const snapshot = () => ({
        customerId: context.customerId,
        itemsTotal: context.itemsTotal.toString(),
        lines: context.lines.map((line) => ({
          variantId: line.variantId,
          quantity: line.quantity,
          price: line.unitPrice.toString(),
        })),
      });
      const before = snapshot();
      // confirm
      expect(context.itemsTotal.toString()).toBe(`${base} VND`);
      // act
      const discount = policy.discountFor(context);
      // assert
      expect(discount.toString()).toBe(`${expected} VND`);
      expect(snapshot()).toEqual(before);
    },
  );

  it('should take the configured basis points off the basket', () => {
    // arrange
    const policy = PercentageDiscountPolicy.create({
      code: 'MEMBER_12_5',
      basisPoints: 1250,
    });

    // confirm
    expect(policy.code).toBe('MEMBER_12_5');

    // act
    const discount = policy.discountFor(contextOf('1000000'));

    // assert
    expect(discount.toString()).toBe('125000 VND');
  });

  it('should stop at the absolute cap when the percentage runs past it', () => {
    // arrange
    const policy = PercentageDiscountPolicy.create({
      code: 'MEMBER_12_5',
      basisPoints: 1250,
      cap: Money.parse('80000', 'VND'),
    });

    // confirm
    expect(policy.discountFor(contextOf('400000')).toString()).toBe('50000 VND');

    // act
    const discount = policy.discountFor(contextOf('1000000'));

    // assert
    expect(discount.toString()).toBe('80000 VND');
  });

  it('should never hand back more than the basket itself', () => {
    // arrange
    const policy = PercentageDiscountPolicy.create({
      code: 'EVERYTHING_OFF',
      basisPoints: 20000,
    });

    // confirm
    expect(policy.code).toBe('EVERYTHING_OFF');

    // act
    const discount = policy.discountFor(contextOf('100000'));

    // assert
    expect(discount.toString()).toBe('100000 VND');
  });

  it('should reject basis points that are not a whole number', () => {
    // arrange
    const props = { code: 'BAD', basisPoints: 12.5 };

    // confirm
    expect(() => PercentageDiscountPolicy.create({ ...props, basisPoints: 1250 })).not.toThrow();

    // act
    const act = () => PercentageDiscountPolicy.create(props);

    // assert
    expect(act).toThrow(DomainError);
    expect(act).toThrow(/INVALID_DISCOUNT_POLICY/);
  });

  it('should reject a negative cap', () => {
    // arrange
    const props = { code: 'BAD', basisPoints: 1250, cap: Money.parse('-1', 'VND') };

    // confirm
    expect(props.cap.isNegative()).toBe(true);

    // act
    const act = () => PercentageDiscountPolicy.create(props);

    // assert
    expect(act).toThrow(/INVALID_DISCOUNT_POLICY/);
  });
});

describe('CompositeDiscountPolicy - ordered pipeline', () => {
  it('should add up what every policy in the chain gives', () => {
    // arrange
    const policy = CompositeDiscountPolicy.of('CHECKOUT', [
      ThresholdDiscountPolicy.create({
        code: 'SPEND_500K_GET_50K',
        minimumSpend: Money.parse('500000', 'VND'),
        discount: Money.parse('50000', 'VND'),
      }),
      PercentageDiscountPolicy.create({ code: 'MEMBER_10', basisPoints: 1000 }),
    ]);

    // confirm
    expect(policy.code).toBe('CHECKOUT');

    // act
    const discount = policy.discountFor(contextOf('1000000'));

    // assert
    expect(discount.toString()).toBe('150000 VND');
  });

  it('should apply the policies in the order they were composed', () => {
    // arrange
    const seen: string[] = [];
    const recording = (code: string): DiscountPolicy => ({
      code,
      discountFor: (context: DiscountContext) => {
        seen.push(code);
        return Money.zero(context.itemsTotal.currency);
      },
    });
    const policy = CompositeDiscountPolicy.of('CHECKOUT', [
      recording('THRESHOLD'),
      recording('PERCENTAGE'),
    ]);

    // confirm
    expect(seen).toEqual([]);

    // act
    policy.discountFor(contextOf('1000000'));

    // assert
    expect(seen).toEqual(['THRESHOLD', 'PERCENTAGE']);
  });

  it('should clamp two generous policies to exactly the basket total', () => {
    // arrange
    const policy = CompositeDiscountPolicy.of('CHECKOUT', [
      new GenerousPolicy('GIFT_A', Money.parse('400000', 'VND')),
      new GenerousPolicy('GIFT_B', Money.parse('400000', 'VND')),
    ]);
    const context = contextOf('500000');

    // confirm
    expect(Money.parse('800000', 'VND').compareTo(context.itemsTotal)).toBe(1);

    // act
    const discount = policy.discountFor(context);

    // assert
    expect(discount.equals(context.itemsTotal)).toBe(true);
    expect(context.itemsTotal.subtract(discount).isNegative()).toBe(false);
  });

  it('should give nothing when the chain is empty', () => {
    // arrange
    const policy = CompositeDiscountPolicy.of('NONE', []);

    // confirm
    expect(policy.code).toBe('NONE');

    // act
    const discount = policy.discountFor(contextOf('1000000'));

    // assert
    expect(discount.equals(Money.zero('VND'))).toBe(true);
  });

  it('should refuse a member policy that hands back a negative discount', () => {
    // arrange
    const policy = CompositeDiscountPolicy.of('CHECKOUT', [
      new GenerousPolicy('ROGUE', Money.parse('-1', 'VND')),
    ]);
    const context = contextOf('500000');

    // confirm
    expect(context.itemsTotal.toString()).toBe('500000 VND');

    // act
    const act = () => policy.discountFor(context);

    // assert
    expect(act).toThrow(DomainError);
    expect(act).toThrow(/INVALID_DISCOUNT/);
    expect(context.itemsTotal.toString()).toBe('500000 VND');
  });

  it('should never mutate the basket it was given', () => {
    // arrange
    const lines = [line('100000', 2)];
    const context = contextOf('200000', lines);
    const policy = CompositeDiscountPolicy.of('CHECKOUT', [
      PercentageDiscountPolicy.create({ code: 'MEMBER_10', basisPoints: 1000 }),
    ]);
    const before = {
      itemsTotal: context.itemsTotal.toString(),
      quantities: lines.map((candidate) => candidate.quantity),
    };

    // confirm
    expect(before.itemsTotal).toBe('200000 VND');

    // act
    policy.discountFor(context);

    // assert
    expect({
      itemsTotal: context.itemsTotal.toString(),
      quantities: lines.map((candidate) => candidate.quantity),
    }).toEqual(before);
  });
});
