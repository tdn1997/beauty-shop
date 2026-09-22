import { expect, it } from 'vitest';
import { multiplyMinorUnits, sumMinorUnits } from './money';
it('should retain exact money above Number safe range', () => {
  expect(multiplyMinorUnits('9007199254740993', 3)).toBe('27021597764222979');
  expect(
    sumMinorUnits([
      { price: '9007199254740993', quantity: 3 },
      { price: '1', quantity: 1 },
    ]),
  ).toBe('27021597764222980');
});
