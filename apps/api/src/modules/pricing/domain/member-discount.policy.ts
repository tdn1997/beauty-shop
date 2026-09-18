import { Money } from '../../shared/domain/money';
import { DiscountContext, DiscountPolicy } from './discount-policy';

export type MemberTier = 'BRONZE' | 'SILVER' | 'GOLD';

export interface MemberContext {
  readonly customerId: string;
  readonly tier: MemberTier;
  readonly lifetimeSpend: Money;
}

export interface MemberDiscountContext extends DiscountContext {
  readonly member: MemberContext;
}

export interface MemberTierResolver {
  resolveTier(customerId: string): MemberContext | null;
}

const TIER_BASIS_POINTS: Readonly<Record<MemberTier, number>> = {
  BRONZE: 200,
  SILVER: 500,
  GOLD: 1000,
};

const MAX_LOYALTY_BASIS_POINTS = 1000;
const LOYALTY_THRESHOLD_VND = 1_000_000n;

export interface MemberDiscountPolicyProps {
  readonly code: string;
  readonly tierResolver: MemberTierResolver;
}

export class MemberDiscountPolicy implements DiscountPolicy {
  readonly code: string;
  readonly #tierResolver: MemberTierResolver;

  private constructor(code: string, tierResolver: MemberTierResolver) {
    this.code = code;
    this.#tierResolver = tierResolver;
  }

  static create(props: MemberDiscountPolicyProps): MemberDiscountPolicy {
    return new MemberDiscountPolicy(props.code, props.tierResolver);
  }

  discountFor(context: DiscountContext): Money {
    const memberContext = this.#tierResolver.resolveTier(context.customerId);
    if (!memberContext) {
      return Money.zero(context.itemsTotal.currency);
    }

    const tierDiscount = context.itemsTotal.percentage(TIER_BASIS_POINTS[memberContext.tier]);

    const loyaltyUnits = memberContext.lifetimeSpend.toMinorUnits() / LOYALTY_THRESHOLD_VND;
    const loyaltyBasisPoints = Number(loyaltyUnits) * 100;
    const cappedLoyalty = Math.min(loyaltyBasisPoints, MAX_LOYALTY_BASIS_POINTS);
    const loyaltyDiscount = context.itemsTotal.percentage(cappedLoyalty);

    const totalDiscount = tierDiscount.add(loyaltyDiscount);
    return totalDiscount.min(context.itemsTotal);
  }
}
