import { describe, expect, it } from 'vitest';

import { DomainError } from '../../shared/domain/domain-error';
import { Money } from '../../shared/domain/money';
import {
  FlatRateShippingPolicy,
  FreeOverThresholdShippingPolicy,
  ShippingContext,
  ShippingPolicy,
} from './shipping-policy';

function contextOf(itemsTotal: string, totalQuantity = 1): ShippingContext {
  return {
    itemsTotal: Money.parse(itemsTotal, 'VND'),
    province: 'TP. Hồ Chí Minh',
    totalQuantity,
  };
}

/** Chính sách nền giả: chỉ để chứng minh `FreeOverThreshold` có uỷ quyền thật. */
class RecordingShippingPolicy implements ShippingPolicy {
  readonly code = 'RECORDING';
  readonly calls: ShippingContext[] = [];

  feeFor(context: ShippingContext): Money {
    this.calls.push(context);
    return Money.parse('30000', 'VND');
  }
}

describe('FlatRateShippingPolicy', () => {
  it('should charge the same fee whatever the basket holds', () => {
    // arrange
    const policy = FlatRateShippingPolicy.create({
      code: 'FLAT_30K',
      fee: Money.parse('30000', 'VND'),
    });

    // confirm
    expect(policy.code).toBe('FLAT_30K');

    // act
    const fees = [policy.feeFor(contextOf('100000')), policy.feeFor(contextOf('9000000', 12))];

    // assert
    expect(fees.map((fee) => fee.toString())).toEqual(['30000 VND', '30000 VND']);
  });

  it('should reject a negative fee', () => {
    // arrange
    const props = { code: 'BAD', fee: Money.parse('-1', 'VND') };

    // confirm
    expect(props.fee.isNegative()).toBe(true);

    // act
    const act = () => FlatRateShippingPolicy.create(props);

    // assert
    expect(act).toThrow(DomainError);
    expect(act).toThrow(/INVALID_SHIPPING_POLICY/);
  });

  it('should reject a blank code', () => {
    // arrange
    const props = { code: '   ', fee: Money.parse('30000', 'VND') };

    // confirm
    expect(() => FlatRateShippingPolicy.create({ ...props, code: 'OK' })).not.toThrow();

    // act
    const act = () => FlatRateShippingPolicy.create(props);

    // assert
    expect(act).toThrow(/INVALID_SHIPPING_POLICY/);
  });
});

describe('FreeOverThresholdShippingPolicy', () => {
  it('should waive the fee once the basket reaches the threshold', () => {
    // arrange
    const policy = FreeOverThresholdShippingPolicy.create({
      code: 'FREE_OVER_500K',
      threshold: Money.parse('500000', 'VND'),
      base: FlatRateShippingPolicy.create({ code: 'FLAT_30K', fee: Money.parse('30000', 'VND') }),
    });

    // confirm
    expect(policy.code).toBe('FREE_OVER_500K');

    // act
    const fee = policy.feeFor(contextOf('500000'));

    // assert
    expect(fee.equals(Money.zero('VND'))).toBe(true);
  });

  it('should delegate to the base policy below the threshold', () => {
    // arrange
    const base = new RecordingShippingPolicy();
    const policy = FreeOverThresholdShippingPolicy.create({
      code: 'FREE_OVER_500K',
      threshold: Money.parse('500000', 'VND'),
      base,
    });

    // confirm
    expect(base.calls).toHaveLength(0);

    // act
    const fee = policy.feeFor(contextOf('499999'));

    // assert
    expect(fee.toString()).toBe('30000 VND');
    expect(base.calls).toHaveLength(1);
  });

  it('should not call the base policy at all once shipping is free', () => {
    // arrange
    const base = new RecordingShippingPolicy();
    const policy = FreeOverThresholdShippingPolicy.create({
      code: 'FREE_OVER_500K',
      threshold: Money.parse('500000', 'VND'),
      base,
    });

    // confirm
    expect(base.calls).toHaveLength(0);

    // act
    policy.feeFor(contextOf('800000'));

    // assert
    expect(base.calls).toHaveLength(0);
  });

  it('should refuse a base policy that hands back a negative fee', () => {
    // arrange
    const rogue: ShippingPolicy = {
      code: 'ROGUE',
      feeFor: () => Money.parse('-1', 'VND'),
    };
    const policy = FreeOverThresholdShippingPolicy.create({
      code: 'FREE_OVER_500K',
      threshold: Money.parse('500000', 'VND'),
      base: rogue,
    });
    const context = contextOf('100000');

    // confirm
    expect(context.itemsTotal.toString()).toBe('100000 VND');

    // act
    const act = () => policy.feeFor(context);

    // assert
    expect(act).toThrow(DomainError);
    expect(act).toThrow(/INVALID_SHIPPING_FEE/);
    expect(context.itemsTotal.toString()).toBe('100000 VND');
  });

  it('should reject a negative threshold', () => {
    // arrange
    const props = {
      code: 'BAD',
      threshold: Money.parse('-1', 'VND'),
      base: FlatRateShippingPolicy.create({ code: 'FLAT_30K', fee: Money.parse('30000', 'VND') }),
    };

    // confirm
    expect(props.threshold.isNegative()).toBe(true);

    // act
    const act = () => FreeOverThresholdShippingPolicy.create(props);

    // assert
    expect(act).toThrow(/INVALID_SHIPPING_POLICY/);
  });
});
