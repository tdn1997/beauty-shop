import { describe, expect, it } from 'vitest';

import { FixedClock } from '../../shared/domain/clock';
import { OutboxEvent, OutboxStatus } from '../domain/outbox-event';
import { OutboxPrismaClient, OutboxEventRow, PrismaOutboxRepository } from './prisma-outbox.repository';

const NOW = new Date('2026-09-17T00:00:00.000Z');
const row: OutboxEventRow = {
  id: 'evt_1', eventType: 'ORDER_CONFIRMED', aggregateId: 'ord_1', payload: { nested: ['a'] },
  occurredAt: NOW, status: OutboxStatus.Pending, attempts: 1, lastError: 'timeout', version: 4,
};

class FakeClient implements OutboxPrismaClient {
  readonly creates: unknown[] = [];
  readonly scans: unknown[] = [];
  readonly updates: unknown[] = [];
  affected = 1;
  failure: Error | null = null;
  readonly outboxEvent = {
    create: async (args: Parameters<OutboxPrismaClient['outboxEvent']['create']>[0]) => {
      if (this.failure) throw this.failure;
      this.creates.push(args);
      return {};
    },
    findMany: async (args: Parameters<OutboxPrismaClient['outboxEvent']['findMany']>[0]) => {
      if (this.failure) throw this.failure;
      this.scans.push(args);
      return [row];
    },
    updateMany: async (args: Parameters<OutboxPrismaClient['outboxEvent']['updateMany']>[0]) => {
      if (this.failure) throw this.failure;
      this.updates.push(args);
      return { count: this.affected };
    },
  };
}

function fresh() {
  return OutboxEvent.record({ id: 'evt_1', eventType: 'ORDER_CONFIRMED', aggregateId: 'ord_1', payload: {} }, new FixedClock(NOW));
}

describe('PrismaOutboxRepository', () => {
  it('should append using the currently active client without opening a transaction', async () => {
    // arrange
    const root = new FakeClient();
    const transaction = new FakeClient();
    let current = root;
    const repository = new PrismaOutboxRepository({ current: () => current });
    const event = fresh();
    // confirm
    expect(event.persistedVersion).toBeNull();
    // act
    current = transaction;
    const result = await repository.append(event);
    // assert
    expect(result.isOk()).toBe(true);
    expect(transaction.creates).toEqual([{ data: event.toSnapshot() }]);
    expect(root.creates).toEqual([]);
    expect(event.persistedVersion).toBe(0);
  });

  it('should scan only pending events oldest first with a bounded batch', async () => {
    // arrange
    const client = new FakeClient();
    const repository = new PrismaOutboxRepository({ current: () => client });
    // confirm
    expect(client.scans).toEqual([]);
    // act
    const events = await repository.findPending(5);
    // assert
    expect(client.scans).toEqual([{ where: { status: OutboxStatus.Pending }, orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }], take: 5 }]);
    expect(Object.isFrozen(events)).toBe(true);
    expect(events[0]).toBeInstanceOf(OutboxEvent);
    expect(events[0]?.toSnapshot()).toEqual(row);
    expect(events[0]?.persistedVersion).toBe(4);
  });

  it('should send the persisted version in the optimistic update condition', async () => {
    // arrange
    const client = new FakeClient();
    const repository = new PrismaOutboxRepository({ current: () => client });
    const [event] = await repository.findPending(1);
    if (!event) throw new Error('missing fixture');
    event.markSent();
    // confirm
    expect(event.persistedVersion).toBe(4);
    // act
    const result = await repository.save(event);
    // assert
    expect(result.isOk()).toBe(true);
    expect(client.updates).toEqual([{ where: { id: 'evt_1', version: 4 }, data: { status: OutboxStatus.Sent, attempts: 1, lastError: 'timeout', version: 5 } }]);
    expect(event.persistedVersion).toBe(5);
  });

  it('should translate zero affected rows without marking the event persisted', async () => {
    // arrange
    const client = new FakeClient();
    client.affected = 0;
    const repository = new PrismaOutboxRepository({ current: () => client });
    const [event] = await repository.findPending(1);
    if (!event) throw new Error('missing fixture');
    event.recordFailure('rejected', 2);
    const before = event.toSnapshot();
    // confirm
    expect(event.persistedVersion).toBe(4);
    // act
    const result = await repository.save(event);
    // assert
    expect(result.errorOrNull()?.code).toBe('CONCURRENT_MODIFICATION');
    expect(client.updates).toEqual([{ where: { id: 'evt_1', version: 4 }, data: { status: OutboxStatus.Failed, attempts: 2, lastError: 'rejected', version: 5 } }]);
    expect(event.persistedVersion).toBe(4);
    expect(event.toSnapshot()).toEqual(before);
  });

  it('should reject saving an event that has never been appended', async () => {
    // arrange
    const client = new FakeClient();
    const repository = new PrismaOutboxRepository({ current: () => client });
    const event = fresh();
    const before = event.toSnapshot();
    // confirm
    expect(event.persistedVersion).toBeNull();
    // act
    const action = repository.save(event);
    // assert
    await expect(action).rejects.toThrow(/INVALID_OUTBOX_EVENT/);
    expect(event.toSnapshot()).toEqual(before);
    expect(client.updates).toEqual([]);
  });

  it('should reject an invalid scan limit without querying', async () => {
    // arrange
    const client = new FakeClient();
    const repository = new PrismaOutboxRepository({ current: () => client });
    // confirm
    expect(client.scans).toEqual([]);
    // act
    const action = repository.findPending(0);
    // assert
    await expect(action).rejects.toThrow(/INVALID_BATCH_SIZE/);
    expect(client.scans).toEqual([]);
  });

  it('should propagate insert infrastructure errors without changing the event', async () => {
    // arrange
    const client = new FakeClient();
    client.failure = new Error('connection lost');
    const repository = new PrismaOutboxRepository({ current: () => client });
    const event = fresh();
    const before = event.toSnapshot();
    // confirm
    expect(event.persistedVersion).toBeNull();
    // act
    const action = repository.append(event);
    // assert
    await expect(action).rejects.toThrow('connection lost');
    expect(event.toSnapshot()).toEqual(before);
    expect(event.persistedVersion).toBeNull();
    expect(client.creates).toEqual([]);
  });

  it('should propagate update infrastructure errors without marking persisted', async () => {
    // arrange
    const client = new FakeClient();
    const repository = new PrismaOutboxRepository({ current: () => client });
    const [event] = await repository.findPending(1);
    if (!event) throw new Error('missing fixture');
    event.markSent();
    const before = event.toSnapshot();
    client.failure = new Error('connection lost');
    // confirm
    expect(event.persistedVersion).toBe(4);
    // act
    const action = repository.save(event);
    // assert
    await expect(action).rejects.toThrow('connection lost');
    expect(event.toSnapshot()).toEqual(before);
    expect(event.persistedVersion).toBe(4);
    expect(client.updates).toEqual([]);
  });
});
