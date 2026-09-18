import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { OutboxStatus } from '../domain/outbox-event';
import { startPostgres, stopPostgres } from '../../../testcontainers/testcontainers.setup';

describe('PrismaOutbox IT', () => {
  let connectionString: string;
  let prisma: PrismaClient;

  beforeAll(async () => {
    connectionString = await startPostgres();
  });

  afterAll(async () => {
    await stopPostgres();
  });

  beforeEach(async () => {
    prisma = new PrismaClient({
      datasources: { db: { url: connectionString } },
    });
  });

  afterEach(async () => {
    await prisma.$executeRaw`TRUNCATE TABLE "outbox_event" CASCADE`;
    await prisma.$disconnect();
  });

  it('IT12: should read pending events and mark them sent atomically', async () => {
    const eventId = `evt-it12-${Date.now()}`;

    await prisma.outboxEvent.create({
      data: {
        id: eventId,
        eventType: 'ORDER_CONFIRMED',
        aggregateId: 'order-1',
        payload: {},
        status: OutboxStatus.Pending,
        occurredAt: new Date(),
        version: 0,
      },
    });

    const [first, second] = await Promise.allSettled([
      prisma.outboxEvent.updateMany({
        where: { id: eventId, status: OutboxStatus.Pending },
        data: { status: OutboxStatus.Sent, version: { increment: 1 } },
      }),
      prisma.outboxEvent.updateMany({
        where: { id: eventId, status: OutboxStatus.Pending },
        data: { status: OutboxStatus.Sent, version: { increment: 1 } },
      }),
    ]);

    const outcomes = [first, second].map((r) =>
      r.status === 'fulfilled' ? (r as PromiseFulfilledResult<{ count: number }>).value.count : -1,
    );
    expect(outcomes.filter((v) => v === 1)).toHaveLength(1);

    const row = await prisma.outboxEvent.findUnique({ where: { id: eventId } });
    expect(row!.status).toBe(OutboxStatus.Sent);
    expect(row!.version).toBe(1);
  });
});
