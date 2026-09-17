import { Module } from '@nestjs/common';

import { OrderingModule } from './modules/ordering/ordering.module';
import { SharedModule } from './modules/shared/shared.module';

/**
 * Composition root. Các module còn lại (catalog, inventory, payment, ...)
 * được đăng ký ở đây khi tầng application/api của chúng ra đời.
 */
@Module({
  imports: [SharedModule, OrderingModule],
})
export class AppModule {}
