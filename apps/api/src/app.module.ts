import { Module } from '@nestjs/common';

import { InventoryModule } from './modules/inventory/inventory.module';
import { OrderingModule } from './modules/ordering/ordering.module';
import { PricingModule } from './modules/pricing/pricing.module';
import { SharedModule } from './modules/shared/shared.module';

/**
 * Composition root. Các module còn lại (catalog, payment, shipping, ...)
 * được đăng ký ở đây khi tầng application/api của chúng ra đời.
 */
@Module({
  imports: [SharedModule, InventoryModule, OrderingModule, PricingModule],
})
export class AppModule {}
