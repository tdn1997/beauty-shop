import { describe, expect, it } from 'vitest';

import { Money } from '../../shared/domain/money';
import { MemberContext, MemberDiscountPolicy, MemberTierResolver } from './member-discount.policy';
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

function contextOf(itemsTotal: string) {
  return {
    customerId: 'cus_1',
    lines: [line('100000', 1)],
    itemsTotal: Money.parse(itemsTotal, 'VND'),
  };
}

class InMemoryMemberResolver implements MemberTierResolver {
  readonly #members: Map<string, MemberContext>;

  constructor(members: MemberContext[] = []) {
    this.#members = new Map(members.map((m) => [m.customerId, m]));
  }

  resolveTier(customerId: string): MemberContext | null {
    return this.#members.get(customerId) ?? null;
  }
}

describe('MemberDiscountPolicy', () => {
  it('should give Bronze customer 2% off', () => {
    const resolver = new InMemoryMemberResolver([
      {
        customerId: 'cus_1',
        tier: 'BRONZE',
        lifetimeSpend: Money.parse('500000', 'VND'),
      },
    ]);
    const policy = MemberDiscountPolicy.create({ code: 'MEMBER', tierResolver: resolver });
    const discount = policy.discountFor(contextOf('1000000'));
    expect(discount.toString()).toBe('20000 VND');
  });

  it('should give Silver customer 5% off', () => {
    const resolver = new InMemoryMemberResolver([
      {
        customerId: 'cus_1',
        tier: 'SILVER',
        lifetimeSpend: Money.parse('500000', 'VND'),
      },
    ]);
    const policy = MemberDiscountPolicy.create({ code: 'MEMBER', tierResolver: resolver });
    const discount = policy.discountFor(contextOf('1000000'));
    expect(discount.toString()).toBe('50000 VND');
  });

  it('should give Gold customer 10% off', () => {
    const resolver = new InMemoryMemberResolver([
      {
        customerId: 'cus_1',
        tier: 'GOLD',
        lifetimeSpend: Money.parse('500000', 'VND'),
      },
    ]);
    const policy = MemberDiscountPolicy.create({ code: 'MEMBER', tierResolver: resolver });
    const discount = policy.discountFor(contextOf('1000000'));
    expect(discount.toString()).toBe('100000 VND');
  });

  it('should give Gold customer with 2M lifetime spend 10% + 2% = 12% off', () => {
    const resolver = new InMemoryMemberResolver([
      {
        customerId: 'cus_1',
        tier: 'GOLD',
        lifetimeSpend: Money.parse('2000000', 'VND'),
      },
    ]);
    const policy = MemberDiscountPolicy.create({ code: 'MEMBER', tierResolver: resolver });
    const discount = policy.discountFor(contextOf('1000000'));
    expect(discount.toString()).toBe('120000 VND');
  });

  it('should give Gold customer with 5M lifetime spend 10% + 5% = 15% off', () => {
    const resolver = new InMemoryMemberResolver([
      {
        customerId: 'cus_1',
        tier: 'GOLD',
        lifetimeSpend: Money.parse('5000000', 'VND'),
      },
    ]);
    const policy = MemberDiscountPolicy.create({ code: 'MEMBER', tierResolver: resolver });
    const discount = policy.discountFor(contextOf('1000000'));
    expect(discount.toString()).toBe('150000 VND');
  });

  it('should treat unknown customer as non-member returning zero discount', () => {
    const resolver = new InMemoryMemberResolver([]);
    const policy = MemberDiscountPolicy.create({ code: 'MEMBER', tierResolver: resolver });
    const context = contextOf('1000000');
    const discount = policy.discountFor(context);
    expect(discount.equals(Money.zero('VND'))).toBe(true);
  });

  it('should never return more than itemsTotal', () => {
    const resolver = new InMemoryMemberResolver([
      {
        customerId: 'cus_1',
        tier: 'GOLD',
        lifetimeSpend: Money.parse('15000000', 'VND'),
      },
    ]);
    const policy = MemberDiscountPolicy.create({ code: 'MEMBER', tierResolver: resolver });
    const context = contextOf('100000');
    const discount = policy.discountFor(context);
    expect(discount.compareTo(context.itemsTotal) <= 0).toBe(true);
  });
});
