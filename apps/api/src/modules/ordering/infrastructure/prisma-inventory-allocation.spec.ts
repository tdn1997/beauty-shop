import { expect, it, vi } from 'vitest';
import { PrismaInventoryAllocation } from './prisma-inventory-allocation';
import { Result } from '../../shared/domain/result';

it('should allocate only available lots for the server selected variant and reserve conditionally', async () => {
  // arrange
  const findMany = vi.fn(async (_args: unknown) => [{ id: 'lot-a', onHand: 3, reserved: 2 }, { id: 'lot-b', onHand: 5, reserved: 0 }]);
  const reserve = vi.fn(async () => Result.ok(undefined));
  const now = new Date('2026-09-17T00:00:00Z');
  const allocation = new PrismaInventoryAllocation({ current: () => ({ inventoryLot: { findMany } }) }, { reserve }, { now: () => now });
  // confirm
  expect(reserve).not.toHaveBeenCalled();
  // act
  const result = await allocation.reserveForVariant('variant', 3);
  // assert
  expect(result.isOk()).toBe(true);
  expect(findMany.mock.calls[0]?.[0]).toMatchObject({ where: { variantId: 'variant', blocked: false, OR: [{ expiresOn: null }, { expiresOn: { gt: now } }] } });
  expect(reserve.mock.calls).toEqual([['lot-a', 1], ['lot-b', 2]]);
});
