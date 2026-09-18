import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { OutboxWorker } from './outbox.worker';

const report = { picked: 0, sent: 0, failed: 0, exhausted: 0 };

describe('OutboxWorker', () => {
  it('should expose its tick to the Nest scheduler', async () => {
    const dispatchPending = vi.fn(async () => report);
    const worker = new OutboxWorker({ dispatchPending }, { error: vi.fn() });
    expect(dispatchPending).not.toHaveBeenCalled();
    await worker.tick();
    expect(dispatchPending).toHaveBeenCalledTimes(1);
    expect(Reflect.getMetadata('SCHEDULE_INTERVAL_OPTIONS', worker.tick)).toEqual({ timeout: 5000 });
  });

  it('should skip overlapping ticks and resume after dispatch finishes', async () => {
    let finish: () => void = () => {};
    const pending = new Promise<typeof report>((resolve) => { finish = () => resolve(report); });
    const dispatchPending = vi.fn(() => pending);
    const worker = new OutboxWorker({ dispatchPending }, { error: vi.fn() });
    expect(dispatchPending).not.toHaveBeenCalled();
    const first = worker.tick();
    await worker.tick();
    const callsWhileBusy = dispatchPending.mock.calls.length;
    finish();
    await first;
    await worker.tick();
    expect(callsWhileBusy).toBe(1);
    expect(dispatchPending).toHaveBeenCalledTimes(2);
  });

  it('should log infrastructure exceptions and permit the next tick', async () => {
    const failure = new Error('connection lost');
    const state = { ...report };
    const before = { ...state };
    const dispatchPending = vi.fn().mockRejectedValueOnce(failure).mockResolvedValue(state);
    const error = vi.fn();
    const worker = new OutboxWorker({ dispatchPending }, { error });
    expect(error).not.toHaveBeenCalled();
    await worker.tick();
    await worker.tick();
    expect(error).toHaveBeenCalledWith(failure);
    expect(dispatchPending).toHaveBeenCalledTimes(2);
    expect(state).toEqual(before);
  });
});
