import { beforeEach, describe, expect, it } from 'vitest';

import { FixedClock } from '../../shared/domain/clock';
import { DomainError } from '../../shared/domain/domain-error';
import { Result } from '../../shared/domain/result';
import { OutboxEvent, OutboxStatus } from '../domain/outbox-event';
import { Notification, NotificationPort } from './notification-port';
import { OutboxDispatcher } from './outbox-dispatcher';
import { OutboxRepository } from './outbox-repository';

const NOW = new Date('2026-09-17T00:00:00.000Z');

function event(id: string): OutboxEvent {
  return OutboxEvent.record(
    { id, eventType: 'ORDER_CONFIRMED', aggregateId: `ord_${id}`, payload: { orderId: id } },
    new FixedClock(NOW),
  );
}

/** Kho outbox giả: giữ sự kiện trong bộ nhớ và ghi lại đúng thứ nó được yêu cầu ghi. */
class FakeOutboxRepository implements OutboxRepository {
  readonly pending: OutboxEvent[] = [];
  readonly saved: OutboxEvent[] = [];
  limitSeen: number | null = null;
  loseRaceOn: string | null = null;

  async append(event: OutboxEvent): Promise<Result<void>> {
    this.pending.push(event);
    return Result.ok(undefined);
  }

  async findPending(limit: number): Promise<readonly OutboxEvent[]> {
    this.limitSeen = limit;
    return this.pending.slice(0, limit);
  }

  async save(event: OutboxEvent): Promise<Result<void>> {
    if (this.loseRaceOn === event.id) {
      return Result.err(new DomainError('CONCURRENT_MODIFICATION', 'Sự kiện vừa bị đổi'));
    }
    this.saved.push(event);
    event.markPersisted();
    return Result.ok(undefined);
  }
}

/**
 * Cổng gửi giả theo kịch bản: từ chối (kết quả nghiệp vụ) hoặc ném (sự cố hạ tầng).
 * Hai thứ đó phải được dispatcher đối xử khác nhau, nên chúng phải tách được ở đây.
 */
class ScriptedNotificationPort implements NotificationPort {
  readonly sent: Notification[] = [];
  rejectAll = false;
  rejectOn: string | null = null;
  throwOn: string | null = null;

  async send(notification: Notification): Promise<Result<void>> {
    if (this.throwOn === notification.aggregateId) throw new Error('connection lost');
    if (this.rejectAll || this.rejectOn === notification.aggregateId) {
      return Result.err(new DomainError('SEND_FAILED', 'Nhà cung cấp từ chối'));
    }
    this.sent.push(notification);
    return Result.ok(undefined);
  }
}

function setup(options = { batchSize: 10, maxAttempts: 3 }) {
  const outbox = new FakeOutboxRepository();
  const notifications = new ScriptedNotificationPort();
  const dispatcher = new OutboxDispatcher(outbox, notifications, options);
  return { outbox, notifications, dispatcher };
}

describe('OutboxDispatcher - sending what is waiting', () => {
  let ctx: ReturnType<typeof setup>;

  beforeEach(() => {
    ctx = setup();
  });

  it('should send every event that is waiting', async () => {
    // arrange
    const { dispatcher, outbox, notifications } = ctx;
    await outbox.append(event('evt_1'));
    await outbox.append(event('evt_2'));

    // confirm
    expect(notifications.sent).toHaveLength(0);

    // act
    const report = await dispatcher.dispatchPending();

    // assert
    expect(report).toEqual({ picked: 2, sent: 2, failed: 0, exhausted: 0 });
    expect(notifications.sent).toHaveLength(2);
  });

  it('should hand the port exactly what the event carries', async () => {
    // arrange
    const { dispatcher, outbox, notifications } = ctx;
    await outbox.append(event('evt_1'));

    // confirm
    expect(notifications.sent).toHaveLength(0);

    // act
    await dispatcher.dispatchPending();

    // assert
    expect(notifications.sent[0]).toEqual({
      eventType: 'ORDER_CONFIRMED',
      aggregateId: 'ord_evt_1',
      payload: { orderId: 'evt_1' },
    });
  });

  it('should write down that an event has gone out', async () => {
    // arrange
    const { dispatcher, outbox } = ctx;
    const waiting = event('evt_1');
    await outbox.append(waiting);

    // confirm
    expect(waiting.status).toBe(OutboxStatus.Pending);

    // act
    await dispatcher.dispatchPending();

    // assert
    expect(waiting.status).toBe(OutboxStatus.Sent);
    expect(outbox.saved).toContain(waiting);
  });

  it('should ask for no more than one batch at a time', async () => {
    // arrange
    const { dispatcher, outbox } = setup({ batchSize: 2, maxAttempts: 3 });
    await outbox.append(event('evt_1'));
    await outbox.append(event('evt_2'));
    await outbox.append(event('evt_3'));

    // confirm
    expect(outbox.limitSeen).toBeNull();

    // act
    const report = await dispatcher.dispatchPending();

    // assert
    expect(outbox.limitSeen).toBe(2);
    expect(report.picked).toBe(2);
  });

  it('should do nothing when the outbox is empty', async () => {
    // arrange
    const { dispatcher, notifications } = ctx;

    // confirm
    expect(notifications.sent).toHaveLength(0);

    // act
    const report = await dispatcher.dispatchPending();

    // assert
    expect(report).toEqual({ picked: 0, sent: 0, failed: 0, exhausted: 0 });
    expect(notifications.sent).toHaveLength(0);
  });
});

describe('OutboxDispatcher - limited retry', () => {
  it('should keep a rejected event waiting for the next round', async () => {
    // arrange
    const { dispatcher, outbox, notifications } = setup();
    const waiting = event('evt_1');
    await outbox.append(waiting);
    notifications.rejectAll = true;

    // confirm
    expect(waiting.attempts).toBe(0);

    // act
    const report = await dispatcher.dispatchPending();

    // assert
    expect(report).toEqual({ picked: 1, sent: 0, failed: 1, exhausted: 0 });
    expect(waiting.status).toBe(OutboxStatus.Pending);
    expect(waiting.attempts).toBe(1);
  });

  it('should write down why the attempt was rejected', async () => {
    // arrange
    const { dispatcher, outbox, notifications } = setup();
    const waiting = event('evt_1');
    await outbox.append(waiting);
    notifications.rejectAll = true;

    // confirm
    expect(waiting.lastError).toBeNull();

    // act
    await dispatcher.dispatchPending();

    // assert
    expect(waiting.lastError).toContain('SEND_FAILED');
    expect(outbox.saved).toContain(waiting);
  });

  it('should give up on an event once its attempt budget is spent', async () => {
    // arrange
    const { dispatcher, outbox, notifications } = setup({ batchSize: 10, maxAttempts: 2 });
    const waiting = event('evt_1');
    await outbox.append(waiting);
    notifications.rejectAll = true;
    await dispatcher.dispatchPending();

    // confirm
    expect(waiting.attempts).toBe(1);
    expect(waiting.status).toBe(OutboxStatus.Pending);

    // act
    const report = await dispatcher.dispatchPending();

    // assert
    expect(report).toEqual({ picked: 1, sent: 0, failed: 0, exhausted: 1 });
    expect(waiting.status).toBe(OutboxStatus.Failed);
  });

  it('should never send an event that has already used up its budget', async () => {
    // arrange
    const { dispatcher, outbox, notifications } = setup({ batchSize: 10, maxAttempts: 1 });
    const spent = event('evt_1');
    spent.recordFailure('hỏng từ trước', 1);
    await outbox.append(spent);

    // confirm
    expect(spent.canRetry(1)).toBe(false);

    // act
    const report = await dispatcher.dispatchPending();

    // assert
    expect(report).toEqual({ picked: 1, sent: 0, failed: 0, exhausted: 0 });
    expect(notifications.sent).toHaveLength(0);
    expect(outbox.saved).toHaveLength(0);
  });

  it('should keep going through the batch when one event is rejected', async () => {
    // arrange
    const { dispatcher, outbox, notifications } = setup();
    const rejected = event('evt_1');
    const fine = event('evt_2');
    await outbox.append(rejected);
    await outbox.append(fine);
    notifications.rejectOn = 'ord_evt_1';

    // confirm
    expect(notifications.sent).toHaveLength(0);

    // act
    const report = await dispatcher.dispatchPending();

    // assert
    expect(report).toEqual({ picked: 2, sent: 1, failed: 1, exhausted: 0 });
    expect(fine.status).toBe(OutboxStatus.Sent);
    expect(rejected.status).toBe(OutboxStatus.Pending);
  });
});

describe('OutboxDispatcher - racing and infrastructure trouble', () => {
  it('should skip an event that someone else has already moved on', async () => {
    // arrange
    const { dispatcher, outbox } = setup();
    const contested = event('evt_1');
    const fine = event('evt_2');
    await outbox.append(contested);
    await outbox.append(fine);
    outbox.loseRaceOn = 'evt_1';

    // confirm
    expect(outbox.saved).toHaveLength(0);

    // act
    const report = await dispatcher.dispatchPending();

    // assert
    expect(report).toEqual({ picked: 2, sent: 1, failed: 0, exhausted: 0 });
    expect(outbox.saved).toEqual([fine]);
  });

  it('should let an infrastructure failure from the port surface', async () => {
    // arrange
    const { dispatcher, outbox, notifications } = setup();
    await outbox.append(event('evt_1'));
    notifications.throwOn = 'ord_evt_1';

    // confirm
    expect(outbox.saved).toHaveLength(0);

    // act
    const act = dispatcher.dispatchPending();

    // assert
    await expect(act).rejects.toThrow('connection lost');
  });

  it('should not lose the work it had already finished when the port breaks', async () => {
    // arrange
    const { dispatcher, outbox, notifications } = setup();
    const first = event('evt_1');
    const breaks = event('evt_2');
    await outbox.append(first);
    await outbox.append(breaks);
    notifications.throwOn = 'ord_evt_2';

    // confirm
    expect(outbox.saved).toHaveLength(0);

    // act
    const act = dispatcher.dispatchPending();

    // assert
    await expect(act).rejects.toThrow('connection lost');
    expect(outbox.saved).toEqual([first]);
    expect(first.status).toBe(OutboxStatus.Sent);
  });

  it('should reject a batch size that is not a positive integer', () => {
    // arrange
    const outbox = new FakeOutboxRepository();
    const notifications = new ScriptedNotificationPort();

    // confirm
    expect(outbox.saved).toHaveLength(0);

    // act
    const act = () => new OutboxDispatcher(outbox, notifications, { batchSize: 0, maxAttempts: 3 });

    // assert
    expect(act).toThrow(/INVALID_BATCH_SIZE/);
  });

  it('should reject an attempt budget that is not a positive integer', () => {
    // arrange
    const outbox = new FakeOutboxRepository();
    const notifications = new ScriptedNotificationPort();

    // confirm
    expect(outbox.saved).toHaveLength(0);

    // act
    const act = () => new OutboxDispatcher(outbox, notifications, { batchSize: 5, maxAttempts: 0 });

    // assert
    expect(act).toThrow(/INVALID_MAX_ATTEMPTS/);
  });
});
