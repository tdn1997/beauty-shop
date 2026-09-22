import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { randomUUID } from 'node:crypto';
import { InventoryModule, INVENTORY_REPOSITORY } from '../inventory/inventory.module';
import { InventoryRepository } from '../inventory/application/inventory-repository';
import { NotificationModule, OUTBOX_REPOSITORY } from '../notification/notification.module';
import { OutboxRepository } from '../notification/application/outbox-repository';
import { PaymentModule, PAYMENT_GATEWAY_REGISTRY } from '../payment/payment.module';
import { PaymentGatewayRegistry } from '../payment/application/payment-gateway.registry';
import { PricingModule } from '../pricing/pricing.module';
import { QuoteService } from '../pricing/application/quote.service';
import { Clock } from '../shared/domain/clock';
import { CLOCK } from '../shared/shared.module';
import { NestHttpExceptionFilter } from '../shared/api/domain-error.filter';
import { PrismaCheckoutReplay, CheckoutReplayClient } from './infrastructure/prisma-checkout-replay';
import { CheckoutService } from './application/checkout.service';
import { CheckoutController } from './api/checkout.controller';
import { AddressController } from './api/address.controller';
import { OwnedQuoteController } from './api/owned-quote.controller';
import { OrderController } from './api/order.controller';
import { CustomerProfileService } from './application/customer-profile.service';
import { AddressReaderClient, PrismaAddressReader } from './infrastructure/prisma-address-reader';
import { AddressBookPrismaClient, PrismaAddressBook } from './infrastructure/prisma-address-book';
import { PrismaInventoryAllocation, AllocationClient } from './infrastructure/prisma-inventory-allocation';

import { PrismaTransactionManager } from '../shared/infrastructure/prisma-transaction-manager';
import { PrismaTransactionClient } from '../shared/infrastructure/prisma.service';
import { SharedModule, TRANSACTIONS } from '../shared/shared.module';
import { OrderCommandService } from './application/order-command.service';
import { OrderQueryService } from './application/order-query.service';
import { OrderRepository } from './application/order-repository';
import { OrderPrismaClient, PrismaOrderRepository } from './infrastructure/prisma-order.repository';

export const ORDER_REPOSITORY = Symbol('OrderRepository');

@Module({
  imports: [SharedModule, InventoryModule, NotificationModule, PaymentModule, PricingModule],
  controllers: [CheckoutController, OrderController, AddressController, OwnedQuoteController],
  providers: [{provide: PrismaAddressBook, inject:[TRANSACTIONS], useFactory:(transactions: PrismaTransactionManager<PrismaTransactionClient>)=>new PrismaAddressBook({current:()=>transactions.current() as unknown as AddressBookPrismaClient})},{provide: CustomerProfileService,inject:[TRANSACTIONS,PrismaAddressBook,QuoteService],useFactory:(transactions:PrismaTransactionManager<PrismaTransactionClient>,book:PrismaAddressBook,quotes:QuoteService)=>new CustomerProfileService(new PrismaAddressReader({current:()=>transactions.current() as unknown as AddressReaderClient}),book,quotes)},
    {
      provide: CheckoutService,
      inject: [TRANSACTIONS, CLOCK, ORDER_REPOSITORY, INVENTORY_REPOSITORY, OUTBOX_REPOSITORY, QuoteService, PAYMENT_GATEWAY_REGISTRY],
      useFactory: (transactions: PrismaTransactionManager<PrismaTransactionClient>, clock: Clock, orders: OrderRepository, inventory: InventoryRepository, outbox: OutboxRepository, quotes: QuoteService, gateways: PaymentGatewayRegistry) => new CheckoutService({
        transactions, clock, orders, outbox, quotes, gateways,
        addresses: new PrismaAddressBook({ current: () => transactions.current() as unknown as AddressBookPrismaClient }),
        inventory: new PrismaInventoryAllocation({ current: () => transactions.current() as unknown as AllocationClient }, inventory, clock),
        replay: new PrismaCheckoutReplay({ current: () => transactions.current() as unknown as CheckoutReplayClient }),
        nextId: randomUUID,
        returnUrl: process.env.PAYMENT_RETURN_URL ?? 'http://localhost:3000/checkout/payment',
      }),
    },
    {
      provide: ORDER_REPOSITORY,
      inject: [TRANSACTIONS],
      useFactory: (transactions: PrismaTransactionManager<PrismaTransactionClient>) =>
        new PrismaOrderRepository({
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
    {
      provide: APP_FILTER,
      useClass: NestHttpExceptionFilter,
    },
  ],
  exports: [OrderCommandService, OrderQueryService],
})
export class OrderingModule {}
