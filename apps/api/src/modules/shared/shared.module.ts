import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR, Reflector } from '@nestjs/core';

import { IdempotencyService } from './application/idempotency.service';
import { IdempotencyStore } from './application/idempotency-store';
import { TransactionManager } from './application/transaction-manager';
import { Clock, SystemClock } from './domain/clock';
import { DomainErrorFilter } from './api/domain-error.filter';
import { IdempotencyInterceptor } from './api/idempotency.interceptor';
import { IdempotencyPrismaClient, PrismaIdempotencyStore } from './infrastructure/prisma-idempotency.store';
import { PrismaService, PrismaTransactionClient } from './infrastructure/prisma.service';
import { PrismaTransactionManager } from './infrastructure/prisma-transaction-manager';

export const CLOCK = Symbol('Clock');
export const IDEMPOTENCY_STORE = Symbol('IdempotencyStore');
export const TRANSACTIONS = Symbol('TransactionManager');

/**
 * Composition root của phần dùng chung: chỗ duy nhất buộc cổng (port) với
 * cài đặt cụ thể. Ca sử dụng chỉ thấy `IdempotencyStore`, `TransactionManager`,
 * `Clock` — muốn đổi Postgres sang thứ khác thì sửa đúng file này.
 */
@Module({
  providers: [
    { provide: CLOCK, useClass: SystemClock },
    PrismaService,
    {
      provide: TRANSACTIONS,
      inject: [PrismaService],
      useFactory: (prisma: PrismaService) =>
        new PrismaTransactionManager<PrismaTransactionClient>(prisma),
    },
    {
      provide: IDEMPOTENCY_STORE,
      inject: [TRANSACTIONS],
      useFactory: (transactions: PrismaTransactionManager<PrismaTransactionClient>) =>
        new PrismaIdempotencyStore(asIdempotencyClient(transactions)),
    },
    {
      provide: IdempotencyService,
      inject: [IDEMPOTENCY_STORE],
      useFactory: (store: IdempotencyStore) => new IdempotencyService(store),
    },
    {
      provide: APP_INTERCEPTOR,
      inject: [Reflector, IdempotencyService],
      useFactory: (reflector: Reflector, idempotency: IdempotencyService) =>
        new IdempotencyInterceptor(reflector, idempotency),
    },
    { provide: APP_FILTER, useClass: DomainErrorFilter },
  ],
  exports: [CLOCK, TRANSACTIONS, IdempotencyService],
})
export class SharedModule {}

/**
 * Thu hẹp client Prisma về đúng bề mặt mà kho idempotency khai báo.
 *
 * Kiểu Prisma sinh ra hẹp hơn (generic theo từng lời gọi) nên TypeScript không
 * tự thấy chúng khớp nhau. Ép kiểu được giữ **ở composition root** — đúng một
 * chỗ, ngay cạnh phần nối dây — thay vì rải vào repository.
 */
function asIdempotencyClient(
  transactions: PrismaTransactionManager<PrismaTransactionClient>,
): { current(): IdempotencyPrismaClient } {
  return { current: () => transactions.current() as unknown as IdempotencyPrismaClient };
}

export type { Clock, TransactionManager };
