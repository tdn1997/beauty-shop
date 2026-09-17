import { describe, expect, it } from 'vitest';

import { FixedClock, SystemClock } from './clock';

describe('FixedClock', () => {
  it('should return the instant it was pinned to', () => {
    // arrange
    const instant = new Date('2026-09-17T03:00:00.000Z');
    const clock = new FixedClock(instant);

    // confirm
    expect(instant.toISOString()).toBe('2026-09-17T03:00:00.000Z');

    // act
    const now = clock.now();

    // assert
    expect(now.toISOString()).toBe('2026-09-17T03:00:00.000Z');
  });

  it('should not leak the internal Date so callers cannot mutate it', () => {
    // arrange
    const instant = new Date('2026-09-17T03:00:00.000Z');
    const clock = new FixedClock(instant);

    // confirm
    expect(clock.now()).not.toBe(instant);

    // act
    clock.now().setFullYear(1999);

    // assert
    expect(clock.now().toISOString()).toBe('2026-09-17T03:00:00.000Z');
  });

  it('should move forward when advanced', () => {
    // arrange
    const clock = new FixedClock(new Date('2026-09-17T03:00:00.000Z'));

    // confirm
    expect(clock.now().toISOString()).toBe('2026-09-17T03:00:00.000Z');

    // act
    clock.advanceBy(60_000);

    // assert
    expect(clock.now().toISOString()).toBe('2026-09-17T03:01:00.000Z');
  });
});

describe('SystemClock', () => {
  it('should return the current wall-clock time', () => {
    // arrange
    const clock = new SystemClock();
    const before = Date.now();

    // confirm
    expect(before).toBeGreaterThan(0);

    // act
    const now = clock.now().getTime();

    // assert
    expect(now).toBeGreaterThanOrEqual(before);
    expect(now).toBeLessThanOrEqual(Date.now());
  });
});
