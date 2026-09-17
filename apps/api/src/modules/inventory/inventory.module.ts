import { Module } from '@nestjs/common';

import { Clock } from '../shared/domain/clock';
import { PrismaTransactionManager } from '../shared/infrastructure/prisma-transaction-manager';
import { PrismaTransactionClient } from '../shared/infrastructure/prisma.service';
import { CLOCK, SharedModule, TRANSACTIONS } from '../shared/shared.module';
import {
  InventoryPrismaClient,
  PrismaInventoryRepository,
} from './infrastructure/prisma-inventory.repository';

export const INVENTORY_REPOSITORY = Symbol('InventoryRepository');

/**
 * Kho hàng chưa có ca sử dụng riêng — `CheckoutService` (Giai đoạn 4) sẽ là
 * người gọi `reserve`. Module này dựng sẵn cổng để lúc đó chỉ việc inject.
 */
@Module({
  imports: [SharedModule],
  providers: [
    {
      provide: INVENTORY_REPOSITORY,
      inject: [TRANSACTIONS, CLOCK],
      useFactory: (
        transactions: PrismaTransactionManager<PrismaTransactionClient>,
        clock: Clock,
      ) =>
        new PrismaInventoryRepository(
          // Ép kiểu giới hạn trong composition root: xem chú thích ở SharedModule.
          { current: () => transactions.current() as unknown as InventoryPrismaClient },
          clock,
        ),
    },
  ],
  exports: [INVENTORY_REPOSITORY],
})
export class InventoryModule {}
