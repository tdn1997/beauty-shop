import { Module } from '@nestjs/common';

import { SharedModule } from '../shared/shared.module';
import { OrderCommandService } from './application/order-command.service';
import { OrderQueryService } from './application/order-query.service';
import { OrderRepository } from './application/order-repository';
import { InMemoryOrderRepository } from './infrastructure/in-memory-order.repository';

export const ORDER_REPOSITORY = Symbol('OrderRepository');

/**
 * Tầng application chỉ biết cổng `OrderRepository`; module này quyết định
 * cài đặt nào được cắm vào. Bản Prisma sẽ thay vào ở Giai đoạn 5.
 */
@Module({
  imports: [SharedModule],
  providers: [
    { provide: ORDER_REPOSITORY, useClass: InMemoryOrderRepository },
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
