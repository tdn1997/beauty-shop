import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';

import { Money } from '../shared/domain/money';
import { QuoteService } from './application/quote.service';
import { PriceCatalog } from './application/price-catalog';
import { PercentageDiscountPolicy } from './domain/discount-policy';
import { FreeOverThresholdShippingPolicy } from './domain/shipping-policy';
import { InMemoryPriceCatalog } from './infrastructure/in-memory-price-catalog';
import { PrismaPriceCatalog } from './infrastructure/prisma-price-catalog';
import { TRANSACTIONS } from '../shared/shared.module';
import { DISCOUNT_POLICY, PRICE_CATALOG, PricingModule, SHIPPING_POLICY } from './pricing.module';

describe('PricingModule', () => {
  it('should bind the ports and export the quote query', async () => {
    // arrange
    const builder = Test.createTestingModule({ imports: [PricingModule] });
    // confirm
    expect(new Set([PRICE_CATALOG, DISCOUNT_POLICY, SHIPPING_POLICY]).size).toBe(3);
    // act
    const module = await builder
      .overrideProvider(TRANSACTIONS)
      .useValue({ current: () => ({ productVariant: { findUnique: async () => null } }) })
      .compile();
    // assert
    expect(module.get(QuoteService)).toBeInstanceOf(QuoteService);
    expect(module.get(PRICE_CATALOG)).toBeInstanceOf(PrismaPriceCatalog);
    expect(await module.get<PriceCatalog>(PRICE_CATALOG).findVariant('missing')).toBeNull();
    expect(module.get(DISCOUNT_POLICY)).toBeInstanceOf(PercentageDiscountPolicy);
    expect(module.get(SHIPPING_POLICY)).toBeInstanceOf(FreeOverThresholdShippingPolicy);
    await module.close();
  });

  it('should compose threshold and percentage discounts with threshold shipping', async () => {
    // arrange
    const catalog = new InMemoryPriceCatalog([
      {
        variantId: 'v1',
        sku: 'SKU',
        name: 'Serum',
        unitPrice: Money.parse('1000000', 'VND'),
        sellable: true,
      },
    ]);
    const module = await Test.createTestingModule({ imports: [PricingModule] })
      .overrideProvider(PRICE_CATALOG)
      .useValue(catalog)
      .compile();
    // confirm
    expect(await catalog.findVariant('v1')).not.toBeNull();
    // act
    const result = await module.get(QuoteService).quoteFor({
      customerId: 'c1',
      currency: 'VND',
      province: 'HCM',
      lines: [{ variantId: 'v1', quantity: 1 }],
    });
    // assert
    expect(result.unwrap().discountTotal().toString()).toBe('100000 VND');
    expect(result.unwrap().shippingFee().toString()).toBe('0 VND');
    expect(result.unwrap().grandTotal().toString()).toBe('900000 VND');
    await module.close();
  });
});
