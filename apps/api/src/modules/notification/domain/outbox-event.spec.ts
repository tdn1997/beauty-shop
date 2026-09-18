import { describe, expect, it } from 'vitest';

import { FixedClock } from '../../shared/domain/clock';
import { OutboxEvent, OutboxStatus } from './outbox-event';

const NOW = new Date('2026-09-17T00:00:00.000Z');

function recordEvent(payload: Record<string, unknown> = { orderId: 'ord_1' }): OutboxEvent {
  return OutboxEvent.record(
    {
      id: 'evt_1',
      eventType: 'ORDER_CONFIRMED',
      aggregateId: 'ord_1',
      payload,
    },
    new FixedClock(NOW),
  );
}

describe('OutboxEvent - recording an event', () => {
  it('should isolate the clock reference and dates nested in payload snapshots', () => {
    // arrange
    const instant = new Date(NOW);
    const event = OutboxEvent.record({ id: 'evt_1', eventType: 'ORDER_CONFIRMED', aggregateId: 'ord_1', payload: { at: instant } }, { now: () => instant });
    const before = event.toSnapshot();
    // confirm
    expect(event.occurredAt).toEqual(NOW);
    // act
    instant.setFullYear(1999);
    (event.payload.at as Date).setFullYear(1998);
    (event.toSnapshot().payload.at as Date).setFullYear(1997);
    // assert
    expect(event.toSnapshot()).toEqual(before);
  });

  it('should start pending so the worker picks it up later', () => {
    // arrange
    const clock = new FixedClock(NOW);

    // confirm
    expect(clock.now()).toEqual(NOW);

    // act
    const event = recordEvent();

    // assert
    expect(event.status).toBe(OutboxStatus.Pending);
    expect(event.attempts).toBe(0);
    expect(event.lastError).toBeNull();
  });

  it('should take the moment it happened from the injected clock', () => {
    // arrange
    const clock = new FixedClock(NOW);

    // confirm
    expect(clock.now()).toEqual(NOW);

    // act
    const event = OutboxEvent.record(
      { id: 'evt_1', eventType: 'ORDER_CONFIRMED', aggregateId: 'ord_1', payload: {} },
      clock,
    );

    // assert
    expect(event.occurredAt).toEqual(NOW);
  });

  it('should hand back a copy of the moment it happened', () => {
    // arrange
    const event = recordEvent();

    // confirm
    expect(event.occurredAt).toEqual(NOW);

    // act
    event.occurredAt.setFullYear(1999);

    // assert
    expect(event.occurredAt).toEqual(NOW);
  });

  it('should keep the payload it was given even if the caller mutates theirs', () => {
    // arrange
    const payload: Record<string, unknown> = { orderId: 'ord_1', total: { amount: '10.00' } };
    const event = recordEvent(payload);

    // confirm
    expect(event.payload).toEqual({ orderId: 'ord_1', total: { amount: '10.00' } });

    // act
    payload.orderId = 'ord_hacked';
    (payload.total as Record<string, unknown>).amount = '0.00';

    // assert
    expect(event.payload.orderId).toBe('ord_1');
    expect((event.payload.total as Record<string, unknown>).amount).toBe('10.00');
  });

  it('should refuse to hand out a payload that can be written through', () => {
    // arrange
    const event = recordEvent({ orderId: 'ord_1', total: { amount: '10.00' } });

    // confirm
    expect(event.payload.orderId).toBe('ord_1');

    // act
    const act = () => {
      (event.payload as Record<string, unknown>).orderId = 'ord_hacked';
    };

    // assert
    expect(act).toThrow();
    expect(event.payload.orderId).toBe('ord_1');
  });

  it('should reject an event with no type', () => {
    // arrange
    const clock = new FixedClock(NOW);

    // confirm
    expect(clock.now()).toEqual(NOW);

    // act
    const act = () =>
      OutboxEvent.record(
        { id: 'evt_1', eventType: '  ', aggregateId: 'ord_1', payload: {} },
        clock,
      );

    // assert
    expect(act).toThrow(/INVALID_OUTBOX_EVENT/);
  });

  it('should reject an event that points at nothing', () => {
    // arrange
    const clock = new FixedClock(NOW);

    // confirm
    expect(clock.now()).toEqual(NOW);

    // act
    const act = () =>
      OutboxEvent.record(
        { id: 'evt_1', eventType: 'ORDER_CONFIRMED', aggregateId: '', payload: {} },
        clock,
      );

    // assert
    expect(act).toThrow(/INVALID_OUTBOX_EVENT/);
  });
});

describe('OutboxEvent - sending', () => {
  it('should become sent once it has gone out', () => {
    // arrange
    const event = recordEvent();

    // confirm
    expect(event.status).toBe(OutboxStatus.Pending);

    // act
    event.markSent();

    // assert
    expect(event.status).toBe(OutboxStatus.Sent);
  });

  it('should bump its version so the optimistic lock has something to compare', () => {
    // arrange
    const event = recordEvent();

    // confirm
    expect(event.version).toBe(0);

    // act
    event.markSent();

    // assert
    expect(event.version).toBe(1);
  });

  it('should refuse to be sent twice', () => {
    // arrange
    const event = recordEvent();
    event.markSent();
    const before = event.toSnapshot();

    // confirm
    expect(event.status).toBe(OutboxStatus.Sent);

    // act
    const act = () => event.markSent();

    // assert
    expect(act).toThrow(/INVALID_TRANSITION/);
    expect(event.toSnapshot()).toEqual(before);
  });
});

describe('OutboxEvent - limited retry', () => {
  it('should stay retryable while attempts are left', () => {
    // arrange
    const event = recordEvent();

    // confirm
    expect(event.attempts).toBe(0);

    // act
    event.recordFailure('SMTP timeout', 3);

    // assert
    expect(event.status).toBe(OutboxStatus.Pending);
    expect(event.attempts).toBe(1);
    expect(event.canRetry(3)).toBe(true);
  });

  it('should remember why the last attempt failed', () => {
    // arrange
    const event = recordEvent();

    // confirm
    expect(event.lastError).toBeNull();

    // act
    event.recordFailure('SMTP timeout', 3);

    // assert
    expect(event.lastError).toBe('SMTP timeout');
  });

  it('should give up for good once the attempt budget is spent', () => {
    // arrange
    const event = recordEvent();
    event.recordFailure('lần 1', 3);
    event.recordFailure('lần 2', 3);

    // confirm
    expect(event.status).toBe(OutboxStatus.Pending);

    // act
    event.recordFailure('lần 3', 3);

    // assert
    expect(event.status).toBe(OutboxStatus.Failed);
    expect(event.attempts).toBe(3);
    expect(event.canRetry(3)).toBe(false);
  });

  it('should refuse any further attempt once it has given up', () => {
    // arrange
    const event = recordEvent();
    event.recordFailure('hỏng', 1);
    const before = event.toSnapshot();

    // confirm
    expect(event.status).toBe(OutboxStatus.Failed);

    // act
    const act = () => event.recordFailure('lại hỏng', 1);

    // assert
    expect(act).toThrow(/INVALID_TRANSITION/);
    expect(event.toSnapshot()).toEqual(before);
  });

  it('should refuse to be sent once it has given up', () => {
    // arrange
    const event = recordEvent();
    event.recordFailure('hỏng', 1);
    const before = event.toSnapshot();

    // confirm
    expect(event.status).toBe(OutboxStatus.Failed);

    // act
    const act = () => event.markSent();

    // assert
    expect(act).toThrow(/INVALID_TRANSITION/);
    expect(event.toSnapshot()).toEqual(before);
  });

  it('should refuse to record a failure with no reason', () => {
    // arrange
    const event = recordEvent();
    const before = event.toSnapshot();

    // confirm
    expect(event.attempts).toBe(0);

    // act
    const act = () => event.recordFailure('   ', 3);

    // assert
    expect(act).toThrow(/INVALID_OUTBOX_EVENT/);
    expect(event.toSnapshot()).toEqual(before);
  });

  it('should refuse an attempt budget that is not a positive integer', () => {
    // arrange
    const event = recordEvent();
    const before = event.toSnapshot();

    // confirm
    expect(event.attempts).toBe(0);

    // act
    const act = () => event.recordFailure('hỏng', 0);

    // assert
    expect(act).toThrow(/INVALID_MAX_ATTEMPTS/);
    expect(event.toSnapshot()).toEqual(before);
  });

  it('should report a sent event as not worth retrying', () => {
    // arrange
    const event = recordEvent();
    event.markSent();

    // confirm
    expect(event.status).toBe(OutboxStatus.Sent);

    // act
    const retryable = event.canRetry(3);

    // assert
    expect(retryable).toBe(false);
  });
});

describe('OutboxEvent - storage shape', () => {
  it('should describe itself well enough to be rebuilt', () => {
    // arrange
    const event = recordEvent({ orderId: 'ord_1' });
    event.recordFailure('SMTP timeout', 3);

    // confirm
    expect(event.attempts).toBe(1);

    // act
    const rebuilt = OutboxEvent.rehydrate(event.toSnapshot());

    // assert
    expect(rebuilt.id).toBe(event.id);
    expect(rebuilt.eventType).toBe(event.eventType);
    expect(rebuilt.aggregateId).toBe(event.aggregateId);
    expect(rebuilt.payload).toEqual(event.payload);
    expect(rebuilt.occurredAt).toEqual(event.occurredAt);
    expect(rebuilt.status).toBe(event.status);
    expect(rebuilt.attempts).toBe(event.attempts);
    expect(rebuilt.lastError).toBe(event.lastError);
    expect(rebuilt.version).toBe(event.version);
  });

  it('should consider a rebuilt event as already stored at that version', () => {
    // arrange
    const event = recordEvent();
    event.markSent();

    // confirm
    expect(event.version).toBe(1);

    // act
    const rebuilt = OutboxEvent.rehydrate(event.toSnapshot());

    // assert
    expect(rebuilt.persistedVersion).toBe(1);
  });

  it('should consider a brand new event as never stored', () => {
    // arrange
    const event = recordEvent();

    // confirm
    expect(event.version).toBe(0);

    // act
    const persisted = event.persistedVersion;

    // assert
    expect(persisted).toBeNull();
  });

  it('should catch up the stored version only after the repository says so', () => {
    // arrange
    const event = recordEvent();
    event.markSent();

    // confirm
    expect(event.persistedVersion).toBeNull();

    // act
    event.markPersisted();

    // assert
    expect(event.persistedVersion).toBe(1);
  });

  it('should hand the repository a payload it cannot write through', () => {
    // arrange
    const event = recordEvent({ orderId: 'ord_1' });

    // confirm
    expect(event.toSnapshot().payload).toEqual({ orderId: 'ord_1' });

    // act
    const act = () => {
      (event.toSnapshot().payload as Record<string, unknown>).orderId = 'ord_hacked';
    };

    // assert
    expect(act).toThrow();
    expect(event.payload.orderId).toBe('ord_1');
  });

  it('should refuse a stored row whose failure carries no reason', () => {
    // arrange
    const event = recordEvent();
    event.recordFailure('hỏng', 1);

    // confirm
    expect(event.status).toBe(OutboxStatus.Failed);

    // act
    const act = () => OutboxEvent.rehydrate({ ...event.toSnapshot(), lastError: null });

    // assert
    expect(act).toThrow(/INVALID_OUTBOX_EVENT/);
  });
});
