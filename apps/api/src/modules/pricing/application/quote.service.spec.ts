import { beforeEach, describe, expect, it } from 'vitest';

import { DomainError } from '../../shared/domain/domain-error';
import { Money } from '../../shared/domain/money';
import {
  CompositeDiscountPolicy,
  PercentageDiscountPolicy,
  ThresholdDiscountPolicy,
} from '../domain/discount-policy';
import {
  FlatRateShippingPolicy,
  FreeOverThresholdShippingPolicy,
} from '../domain/shipping-policy';
import { InMemoryPriceCatalog } from '../infrastructure/in-memory-price-catalog';
import { PriceCatalog, PricedVariant } from './price-catalog';
import { QuoteRequest, QuoteService } from './quote.service';

const serum: PricedVariant = {
  variantId: 'var_1',
  sku: 'SRM-VTC-30',
  name: 'Serum Vitamin C 30ml',
  unitPrice: Money.parse('459000', 'VND'),
  sellable: true,
};

const cream: PricedVariant = {
  variantId: 'var_2',
  sku: 'CRM-NGT-50',
  name: 'Kem dưỡng đêm 50ml',
  unitPrice: Money.parse('82000', 'VND'),
  sellable: true,
};

const discontinued: PricedVariant = {
  variantId: 'var_3',
  sku: 'MSK-HYD-01',
  name: 'Mặt nạ cấp ẩm',
  unitPrice: Money.parse('35000', 'VND'),
  sellable: false,
};

const imported: PricedVariant = {
  variantId: 'var_4',
  sku: 'PRF-IMP-10',
  name: 'Nước hoa nhập khẩu',
  unitPrice: Money.parse('89.00', 'USD'),
  sellable: true,
};

/** Catalog giả mô phỏng lỗi hạ tầng — KHÔNG phải kết quả nghiệp vụ dự kiến. */
class CatalogAlwaysFails implements PriceCatalog {
  async findVariant(): Promise<PricedVariant | null> {
    throw new Error('connection lost');
  }
}

function setup() {
  const catalog = new InMemoryPriceCatalog([serum, cream, discontinued, imported]);
  const discounts = CompositeDiscountPolicy.of('CHECKOUT', [
    ThresholdDiscountPolicy.create({
      code: 'SPEND_500K_GET_50K',
      minimumSpend: Money.parse('500000', 'VND'),
      discount: Money.parse('50000', 'VND'),
    }),
    PercentageDiscountPolicy.create({
      code: 'MEMBER_10',
      basisPoints: 1000,
      cap: Money.parse('100000', 'VND'),
    }),
  ]);
  const shipping = FreeOverThresholdShippingPolicy.create({
    code: 'FREE_OVER_500K',
    threshold: Money.parse('500000', 'VND'),
    base: FlatRateShippingPolicy.create({ code: 'FLAT_30K', fee: Money.parse('30000', 'VND') }),
  });

  return { catalog, service: new QuoteService(catalog, discounts, shipping) };
}

function requestOf(overrides: Partial<QuoteRequest> = {}): QuoteRequest {
  return {
    customerId: 'cus_1',
    currency: 'VND',
    province: 'TP. Hồ Chí Minh',
    lines: [{ variantId: 'var_1', quantity: 2 }],
    ...overrides,
  };
}

describe('QuoteService - happy path', () => {
  let ctx: ReturnType<typeof setup>;

  beforeEach(() => {
    ctx = setup();
  });

  it('should price a basket from the catalog snapshot', async () => {
    // arrange
    const { service } = ctx;
    const request = requestOf();

    // confirm
    expect(request.lines).toHaveLength(1);

    // act
    const result = await service.quoteFor(request);

    // assert
    const quote = result.unwrap();
    expect(quote.itemsTotal().toString()).toBe('918000 VND');
    expect(quote.lines[0]?.sku).toBe('SRM-VTC-30');
    expect(quote.lines[0]?.nameSnapshot).toBe('Serum Vitamin C 30ml');
  });

  it('should run the discount pipeline over the whole basket', async () => {
    // arrange
    const { service } = ctx;
    const request = requestOf();

    // confirm
    expect(request.customerId).toBe('cus_1');

    // act
    const quote = (await service.quoteFor(request)).unwrap();

    // assert
    expect(quote.discountTotal().toString()).toBe('141800 VND');
  });

  it('should waive shipping once the basket clears the threshold', async () => {
    // arrange
    const { service } = ctx;
    const request = requestOf();

    // confirm
    expect(request.province).toBe('TP. Hồ Chí Minh');

    // act
    const quote = (await service.quoteFor(request)).unwrap();

    // assert
    expect(quote.shippingFee().equals(Money.zero('VND'))).toBe(true);
    expect(quote.grandTotal().toString()).toBe('776200 VND');
  });

  it('should charge the flat fee for a small basket', async () => {
    // arrange
    const { service } = ctx;
    const request = requestOf({ lines: [{ variantId: 'var_2', quantity: 1 }] });

    // confirm
    expect(request.lines[0]?.variantId).toBe('var_2');

    // act
    const quote = (await service.quoteFor(request)).unwrap();

    // assert
    expect(quote.itemsTotal().toString()).toBe('82000 VND');
    expect(quote.shippingFee().toString()).toBe('30000 VND');
    expect(quote.grandTotal().toString()).toBe('103800 VND');
  });

  it('should keep one quote line per requested line', async () => {
    // arrange
    const { service } = ctx;
    const request = requestOf({
      lines: [
        { variantId: 'var_1', quantity: 1 },
        { variantId: 'var_2', quantity: 3 },
      ],
    });

    // confirm
    expect(request.lines).toHaveLength(2);

    // act
    const quote = (await service.quoteFor(request)).unwrap();

    // assert
    expect(quote.lines.map((line) => line.sku)).toEqual(['SRM-VTC-30', 'CRM-NGT-50']);
    expect(quote.itemsTotal().toString()).toBe('705000 VND');
  });
});

describe('QuoteService - expected business outcomes', () => {
  let ctx: ReturnType<typeof setup>;

  beforeEach(() => {
    ctx = setup();
  });

  it('should refuse an empty basket', async () => {
    // arrange
    const { service } = ctx;
    const request = requestOf({ lines: [] });

    // confirm
    expect(request.lines).toHaveLength(0);

    // act
    const result = await service.quoteFor(request);

    // assert
    expect(result.isErr()).toBe(true);
    expect(result.errorOrNull()?.code).toBe('EMPTY_BASKET');
  });

  it('should report a variant the catalog does not know', async () => {
    // arrange
    const { service } = ctx;
    const request = requestOf({ lines: [{ variantId: 'var_missing', quantity: 1 }] });

    // confirm
    expect(await ctx.catalog.findVariant('var_missing')).toBeNull();

    // act
    const result = await service.quoteFor(request);

    // assert
    expect(result.errorOrNull()?.code).toBe('VARIANT_NOT_FOUND');
  });

  it('should report a variant that is no longer sellable', async () => {
    // arrange
    const { service } = ctx;
    const request = requestOf({ lines: [{ variantId: 'var_3', quantity: 1 }] });

    // confirm
    expect((await ctx.catalog.findVariant('var_3'))?.sellable).toBe(false);

    // act
    const result = await service.quoteFor(request);

    // assert
    expect(result.errorOrNull()?.code).toBe('VARIANT_NOT_SELLABLE');
  });

  it('should report a variant priced in another currency', async () => {
    // arrange
    const { service } = ctx;
    const request = requestOf({ lines: [{ variantId: 'var_4', quantity: 1 }] });

    // confirm
    expect((await ctx.catalog.findVariant('var_4'))?.unitPrice.currency).toBe('USD');

    // act
    const result = await service.quoteFor(request);

    // assert
    expect(result.errorOrNull()?.code).toBe('CURRENCY_MISMATCH');
  });

  it('should stop at the first offending line and price nothing', async () => {
    // arrange
    const { service } = ctx;
    const request = requestOf({
      lines: [
        { variantId: 'var_1', quantity: 1 },
        { variantId: 'var_missing', quantity: 1 },
      ],
    });

    // confirm
    expect((await service.quoteFor(requestOf())).isOk()).toBe(true);

    // act
    const result = await service.quoteFor(request);

    // assert
    expect(result.isErr()).toBe(true);
    expect(result.errorOrNull()?.details.variantId).toBe('var_missing');
  });
});

describe('QuoteService - invariant violations and infrastructure', () => {
  let ctx: ReturnType<typeof setup>;

  beforeEach(() => {
    ctx = setup();
  });

  it('should throw on a non-positive quantity instead of returning a Result', async () => {
    // arrange
    const { service } = ctx;
    const request = requestOf({ lines: [{ variantId: 'var_1', quantity: 0 }] });

    // confirm
    expect((await service.quoteFor(requestOf())).isOk()).toBe(true);

    // act
    const act = service.quoteFor(request);

    // assert
    await expect(act).rejects.toThrow(DomainError);
    await expect(act).rejects.toThrow(/INVALID_QUANTITY/);
  });

  it('should let an infrastructure failure propagate instead of swallowing it', async () => {
    // arrange
    const { service } = ctx;
    const broken = new QuoteService(
      new CatalogAlwaysFails(),
      CompositeDiscountPolicy.of('NONE', []),
      FlatRateShippingPolicy.create({ code: 'FLAT_30K', fee: Money.parse('30000', 'VND') }),
    );

    // confirm
    expect((await service.quoteFor(requestOf())).isOk()).toBe(true);

    // act
    const act = broken.quoteFor(requestOf());

    // assert
    await expect(act).rejects.toThrow(/connection lost/);
    await expect(act).rejects.not.toBeInstanceOf(DomainError);
  });
});

describe('QuoteService - preconditions', () => {
  it('should reject invalid quantities before catalog lookup without changing the request', async () => {
    // arrange
    const request = requestOf({ lines: [{ variantId: 'missing', quantity: 0 }] });
    const before = JSON.stringify(request);
    const service = new QuoteService(new CatalogAlwaysFails(), CompositeDiscountPolicy.of('NONE', []),
      FlatRateShippingPolicy.create({ code: 'FREE', fee: Money.zero('VND') }));
    // confirm
    expect(request.lines[0]?.quantity).toBe(0);
    // act
    const result = service.quoteFor(request);
    // assert
    await expect(result).rejects.toThrow(/INVALID_QUANTITY/);
    expect(JSON.stringify(request)).toBe(before);
  });
});

describe('QuoteService - query side only', () => {
  it('should only expose read-shaped methods', () => {
    // arrange
    const prototype = QuoteService.prototype;

    // confirm
    expect(typeof prototype.quoteFor).toBe('function');

    // act
    const methods = Object.getOwnPropertyNames(prototype).filter((name) => name !== 'constructor');

    // assert
    expect(methods).toEqual(['quoteFor']);
    expect(methods.every((name) => /^(find|get|list|count|quote)/.test(name))).toBe(true);
  });
});
