import { describe, expect, it } from 'vitest';
import { ScryptPasswordHasher } from './scrypt-password-hasher';
describe('ScryptPasswordHasher', () => {
  it('should hash and verify a bounded password asynchronously', async () => {
    const h = new ScryptPasswordHasher();
    const encoded = await h.hash('a-strong-password');
    expect(encoded).toMatch(/^scrypt\$v1\$/);
    expect(await h.verify('a-strong-password', encoded)).toBe(true);
    expect(await h.verify('wrong-password', encoded)).toBe(false);
  });
});
