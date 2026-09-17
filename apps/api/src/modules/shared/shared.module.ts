import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR, Reflector } from '@nestjs/core';

import { IdempotencyService } from './application/idempotency.service';
import { IdempotencyStore } from './application/idempotency-store';
import { Clock, SystemClock } from './domain/clock';
import { DomainErrorFilter } from './api/domain-error.filter';
import { IdempotencyInterceptor } from './api/idempotency.interceptor';
import { InMemoryIdempotencyStore } from './infrastructure/in-memory-idempotency.store';

export const CLOCK = Symbol('Clock');
export const IDEMPOTENCY_STORE = Symbol('IdempotencyStore');

/**
 * Composition root của phần dùng chung: chỗ duy nhất buộc cổng (port) với
 * cài đặt cụ thể. Đổi `InMemoryIdempotencyStore` sang bản Postgres
 * chỉ cần sửa đúng dòng `useClass` ở đây.
 */
@Module({
  providers: [
    { provide: CLOCK, useClass: SystemClock },
    { provide: IDEMPOTENCY_STORE, useClass: InMemoryIdempotencyStore },
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
  exports: [CLOCK, IdempotencyService],
})
export class SharedModule {}

export type { Clock };
