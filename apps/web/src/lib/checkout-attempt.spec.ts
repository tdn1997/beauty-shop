import { describe, expect, it, vi } from 'vitest';
import { canonicalAttempt, loadAttempt } from './checkout-attempt';
describe('checkout attempt', () => {
  it('should bind key to user address currency and sorted cart', () => {
    vi.stubGlobal('crypto', { randomUUID: () => 'new-key' });
    const input = {
      userId: 'u',
      addressId: 'a',
      currency: 'VND' as const,
      lines: [
        { variantId: 'z', quantity: 1 },
        { variantId: 'a', quantity: 2 },
      ],
    };
    const one = loadAttempt(input, null),
      two = loadAttempt(input, JSON.stringify(one));
    expect(two.key).toBe('new-key');
    expect(two.canonical).toBe(canonicalAttempt({ ...input, lines: [...input.lines].reverse() }));
    expect(loadAttempt({ ...input, addressId: 'other' }, JSON.stringify(one))).toEqual(one);
  });
});
