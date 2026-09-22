import { Module } from '@nestjs/common';

import { SharedModule, TRANSACTIONS } from '../shared/shared.module';
import { Money } from '../shared/domain/money';
import { PrismaTransactionManager } from '../shared/infrastructure/prisma-transaction-manager';
import { PrismaTransactionClient } from '../shared/infrastructure/prisma.service';
import { PriceCatalog } from './application/price-catalog';
import { QuoteService } from './application/quote.service';
import { DiscountPolicy, PercentageDiscountPolicy } from './domain/discount-policy';
import {
  FlatRateShippingPolicy,
  FreeOverThresholdShippingPolicy,
  ShippingPolicy,
} from './domain/shipping-policy';
import {
  PriceCatalogPrismaClient,
  PrismaPriceCatalog,
} from './infrastructure/prisma-price-catalog';

export const PRICE_CATALOG = Symbol('PriceCatalog');
export const DISCOUNT_POLICY = Symbol('DiscountPolicy');
export const SHIPPING_POLICY = Symbol('ShippingPolicy');

@Module({
  imports: [SharedModule],
  controllers: [],
  providers: [
    {
      provide: PRICE_CATALOG,
      inject: [TRANSACTIONS],
      // Ép kiểu ở composition root, cùng chỗ nối dây — không rải vào adapter.
      // Kiểu Prisma sinh ra hẹp hơn interface `PriceCatalogPrismaClient` khai
      // báo (generic theo từng lời gọi) nên TypeScript không tự thấy khớp.
      useFactory: (transactions: PrismaTransactionManager<PrismaTransactionClient>) =>
        new PrismaPriceCatalog({
          current: () => transactions.current() as unknown as PriceCatalogPrismaClient,
        }),
    },
    {
      provide: DISCOUNT_POLICY,
      useFactory: () =>
        PercentageDiscountPolicy.create({
          code: 'CHECKOUT',
          minimumSpend: Money.parse('500000', 'VND'),
          basisPoints: 1000,
          cap: Money.parse('100000', 'VND'),
        }),
    },
    {
      provide: SHIPPING_POLICY,
      useFactory: () =>
        FreeOverThresholdShippingPolicy.create({
          code: 'FREE_OVER_500K',
          threshold: Money.parse('500000', 'VND'),
          base: FlatRateShippingPolicy.create({
            code: 'FLAT_30K',
            fee: Money.parse('30000', 'VND'),
          }),
        }),
    },
    {
      provide: QuoteService,
      inject: [PRICE_CATALOG, DISCOUNT_POLICY, SHIPPING_POLICY],
      useFactory: (catalog: PriceCatalog, discounts: DiscountPolicy, shipping: ShippingPolicy) =>
        new QuoteService(catalog, discounts, shipping),
    },
  ],
  exports: [QuoteService, PRICE_CATALOG, DISCOUNT_POLICY, SHIPPING_POLICY],
})
export class PricingModule {}
