import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';

import { AppModule } from './app.module';
import { PrismaService } from './modules/shared/infrastructure/prisma.service';
import { CatalogController } from './modules/catalog/api/catalog.controller';
import { AuthController } from './modules/iam/api/auth.controller';
import { InventoryController } from './modules/inventory/api/inventory.controller';
import { CheckoutController } from './modules/ordering/api/checkout.controller';
import { AddressController } from './modules/ordering/api/address.controller';
import { OwnedQuoteController } from './modules/ordering/api/owned-quote.controller';
import { OrderController } from './modules/ordering/api/order.controller';

/**
 * Test khởi động (composition/bootstrap): dựng toàn bộ đồ thị provider của
 * `AppModule` như Nest thật sự làm lúc chạy. Nếu bất kỳ controller/provider
 * nào không phân giải được token thời gian chạy (ví dụ inject một interface
 * TypeScript thay vì token), test này đỏ ngay ở `compile()` thay vì đợi
 * server khởi động thật mới lộ ra `UnknownDependenciesException`.
 *
 * `PrismaService` được thay bằng client giả — test không chạm CSDL thật.
 */
function fakePrisma() {
  const empty = async () => [];
  const nullOne = async () => null;
  return {
    product: { findMany: empty },
    productVariant: { findUnique: nullOne },
    inventoryLot: { groupBy: async () => [] },
    user: { findUnique: nullOne },
    session: { create: async () => undefined, findUnique: nullOne, update: async () => undefined },
    customerAddress: { findMany: empty, findFirst: nullOne },
    order: {
      create: async () => undefined,
      findUnique: nullOne,
      findMany: empty,
      count: async () => 0,
    },
    outboxEvent: { create: async () => undefined, findMany: empty, update: async () => undefined },
    inventoryReservation: { findMany: empty },
    idempotencyRecord: {
      findUnique: nullOne,
      create: async () => undefined,
      update: async () => undefined,
    },
    checkoutReplay: { findUnique: nullOne, create: async () => undefined },
    $transaction: async (work: (tx: unknown) => unknown) => work({}),
  };
}

describe('AppModule composition', () => {
  it('should resolve every controller and provider in the application graph without a real database', async () => {
    // arrange
    const builder = Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(fakePrisma());

    // act
    const module = await builder.compile();

    // assert
    expect(module.get(CatalogController)).toBeInstanceOf(CatalogController);
    expect(module.get(AuthController)).toBeInstanceOf(AuthController);
    expect(module.get(InventoryController)).toBeInstanceOf(InventoryController);
    expect(module.get(CheckoutController)).toBeInstanceOf(CheckoutController);
    expect(module.get(AddressController)).toBeInstanceOf(AddressController);
    expect(module.get(OwnedQuoteController)).toBeInstanceOf(OwnedQuoteController);
    expect(module.get(OrderController)).toBeInstanceOf(OrderController);
    await module.close();
  });
});
