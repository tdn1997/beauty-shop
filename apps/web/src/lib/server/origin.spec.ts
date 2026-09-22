import { expect, it } from 'vitest';
import { hasTrustedOrigin } from './origin';
it('should require exact configured origin', () => {
  expect(hasTrustedOrigin('https://shop.test', 'https://shop.test')).toBe(true);
  expect(hasTrustedOrigin(null, 'https://shop.test')).toBe(false);
  expect(hasTrustedOrigin('https://shop.test.evil', 'https://shop.test')).toBe(false);
});
