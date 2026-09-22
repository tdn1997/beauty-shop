import { expect, it } from 'vitest';
import { safeReturnPath } from './safe-return';
it('should reject absolute protocol-relative encoded and backslash redirects', () => {
  expect(safeReturnPath('https://evil.test')).toBe('/');
  expect(safeReturnPath('//evil.test')).toBe('/');
  expect(safeReturnPath('%2F%2Fevil.test')).toBe('/');
  expect(safeReturnPath('/safe\\evil')).toBe('/');
  expect(safeReturnPath('/checkout')).toBe('/checkout');
});
