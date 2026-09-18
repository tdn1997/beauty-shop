import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';

import { Clock } from '../shared/domain/clock';
import { NestHttpExceptionFilter } from '../shared/api/domain-error.filter';
import { PrismaTransactionManager } from '../shared/infrastructure/prisma-transaction-manager';
import { PrismaTransactionClient } from '../shared/infrastructure/prisma.service';
import { CLOCK, SharedModule, TRANSACTIONS } from '../shared/shared.module';
import { InventoryController } from './api/inventory.controller';
import { InventoryQueryService } from './application/inventory-query.service';
import {
  InventoryPrismaClient,
  PrismaInventoryRepository,
} from './infrastructure/prisma-inventory.repository';

const INVENTORY_REPOSITORY = Symbol('InventoryRepository');

@Module({
  imports: [SharedModule],
  controllers: [InventoryController],
  providers: [
    {
      provide: INVENTORY_REPOSITORY,
      inject: [TRANSACTIONS, CLOCK],
      useFactory: (
        transactions: PrismaTransactionManager<PrismaTransactionClient>,
        clock: Clock,
      ) =>
        new PrismaInventoryRepository(
          { current: () => transactions.current() as unknown as InventoryPrismaClient },
          clock,
        ),
    },
    {
      provide: InventoryQueryService,
      inject: [INVENTORY_REPOSITORY],
      useFactory: (repository: PrismaInventoryRepository) => new InventoryQueryService(repository),
    },
    {
      provide: APP_FILTER,
      useClass: NestHttpExceptionFilter,
    },
  ],
  exports: [INVENTORY_REPOSITORY, InventoryQueryService],
})
export class InventoryModule {}

export { INVENTORY_REPOSITORY };
