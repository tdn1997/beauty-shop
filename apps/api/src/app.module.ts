import { Module } from '@nestjs/common';

import { InventoryModule } from './modules/inventory/inventory.module';
import { OrderingModule } from './modules/ordering/ordering.module';
import { PricingModule } from './modules/pricing/pricing.module';
import { IamModule } from './modules/iam/iam.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { SharedModule } from './modules/shared/shared.module';

/**
 * Composition root. Các module còn lại (catalog, payment, shipping, ...)
 * được đăng ký ở đây khi tầng application/api của chúng ra đời.
 */
@Module({
  imports: [SharedModule, IamModule, CatalogModule, InventoryModule, OrderingModule, PricingModule],
})
export class AppModule {}
