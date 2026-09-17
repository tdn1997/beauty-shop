import { describe, expect, it } from 'vitest';

import { DomainError } from './domain-error';
import { requireState } from './guards';

describe('requireState', () => {
  it('should pass when the current state is allowed', () => {
    // arrange
    const current = 'DRAFT';

    // confirm
    expect(current).toBe('DRAFT');

    // act
    const act = () => requireState(current, ['DRAFT', 'QUOTED'], 'confirm');

    // assert
    expect(act).not.toThrow();
  });

  it('should refuse a transition from a state that is not allowed', () => {
    // arrange
    const current = 'CANCELLED';

    // confirm
    expect(() => requireState('DRAFT', ['DRAFT'], 'confirm')).not.toThrow();

    // act
    const act = () => requireState(current, ['DRAFT'], 'confirm');

    // assert
    expect(act).toThrow(DomainError);
    expect(act).toThrow(/INVALID_TRANSITION/);
  });

  it('should report the attempted action and the states involved', () => {
    // arrange
    const current = 'CANCELLED';
    let captured: DomainError | null = null;

    // confirm
    expect(captured).toBeNull();

    // act
    try {
      requireState(current, ['DRAFT', 'QUOTED'], 'confirm');
    } catch (error) {
      captured = error as DomainError;
    }

    // assert
    expect(captured?.details).toEqual({
      action: 'confirm',
      current: 'CANCELLED',
      allowed: ['DRAFT', 'QUOTED'],
    });
  });
});
