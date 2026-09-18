import { Logger, Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

import { PrismaTransactionManager } from '../shared/infrastructure/prisma-transaction-manager';
import { PrismaTransactionClient } from '../shared/infrastructure/prisma.service';
import { SharedModule, TRANSACTIONS } from '../shared/shared.module';
import { NotificationPort } from './application/notification-port';
import { OutboxDispatcher } from './application/outbox-dispatcher';
import { OutboxRepository } from './application/outbox-repository';
import { LogNotificationAdapter } from './infrastructure/log-notification.adapter';
import { OutboxWorker } from './infrastructure/outbox.worker';
import { OutboxPrismaClient, PrismaOutboxRepository } from './infrastructure/prisma-outbox.repository';

export const OUTBOX_REPOSITORY = Symbol('OutboxRepository');
export const NOTIFICATION_PORT = Symbol('NotificationPort');

@Module({
  imports: [SharedModule, ScheduleModule.forRoot()],
  providers: [
    {
      provide: OUTBOX_REPOSITORY,
      inject: [TRANSACTIONS],
      useFactory: (transactions: PrismaTransactionManager<PrismaTransactionClient>) =>
        new PrismaOutboxRepository({
          // Ép kiểu giới hạn trong composition root: xem chú thích ở SharedModule.
          current: () => transactions.current() as unknown as OutboxPrismaClient,
        }),
    },
    {
      provide: NOTIFICATION_PORT,
      useFactory: () => {
        const logger = new Logger('Notification');
        return new LogNotificationAdapter({ write: (line) => logger.log(line) });
      },
    },
    {
      provide: OutboxDispatcher,
      inject: [OUTBOX_REPOSITORY, NOTIFICATION_PORT],
      useFactory: (outbox: OutboxRepository, notifications: NotificationPort) =>
        new OutboxDispatcher(outbox, notifications, { batchSize: 100, maxAttempts: 3 }),
    },
    {
      provide: OutboxWorker,
      inject: [OutboxDispatcher],
      useFactory: (dispatcher: OutboxDispatcher) =>
        new OutboxWorker(dispatcher, new Logger('OutboxWorker')),
    },
  ],
  exports: [OUTBOX_REPOSITORY, OutboxDispatcher],
})
export class NotificationModule {}
