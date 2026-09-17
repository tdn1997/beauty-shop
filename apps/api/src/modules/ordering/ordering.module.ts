import { Module } from '@nestjs/common';

import { PrismaTransactionManager } from '../shared/infrastructure/prisma-transaction-manager';
import { PrismaTransactionClient } from '../shared/infrastructure/prisma.service';
import { SharedModule, TRANSACTIONS } from '../shared/shared.module';
import { OrderCommandService } from './application/order-command.service';
import { OrderQueryService } from './application/order-query.service';
import { OrderRepository } from './application/order-repository';
import { OrderPrismaClient, PrismaOrderRepository } from './infrastructure/prisma-order.repository';

export const ORDER_REPOSITORY = Symbol('OrderRepository');

/**
 * Tầng application chỉ biết cổng `OrderRepository`; module này quyết định cài
 * đặt nào được cắm vào. Đổi `PrismaOrderRepository` sang bản khác là sửa đúng
 * một dòng ở đây — `OrderCommandService` và `OrderQueryService` không đổi.
 */
@Module({
  imports: [SharedModule],
  providers: [
    {
      provide: ORDER_REPOSITORY,
      inject: [TRANSACTIONS],
      useFactory: (transactions: PrismaTransactionManager<PrismaTransactionClient>) =>
        new PrismaOrderRepository({
          // Ép kiểu giới hạn trong composition root: xem chú thích ở SharedModule.
          current: () => transactions.current() as unknown as OrderPrismaClient,
        }),
    },
    {
      provide: OrderCommandService,
      inject: [ORDER_REPOSITORY],
      useFactory: (orders: OrderRepository) => new OrderCommandService(orders),
    },
    {
      provide: OrderQueryService,
      inject: [ORDER_REPOSITORY],
      useFactory: (orders: OrderRepository) => new OrderQueryService(orders),
    },
  ],
  exports: [OrderCommandService, OrderQueryService],
})
export class OrderingModule {}
