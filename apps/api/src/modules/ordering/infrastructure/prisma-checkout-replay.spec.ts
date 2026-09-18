import { expect, it, vi } from 'vitest';
import { PrismaCheckoutReplay } from './prisma-checkout-replay';

it('should claim checkout keys without aborting the transaction on a duplicate', async () => {
  // arrange
  const createMany = vi.fn(async (_args: unknown) => ({ count: 0 }));
  const client = { checkoutReplay: { createMany, findUnique: vi.fn(), update: vi.fn() } };
  const replay = new PrismaCheckoutReplay({ current: () => client });
  // confirm
  expect(createMany).not.toHaveBeenCalled();
  // act
  const claimed = await replay.reserve('customer', 'key', 'hash');
  // assert
  expect(claimed).toBe(false);
  expect(createMany).toHaveBeenCalledWith({ data: [{ customerId: 'customer', key: 'key', requestHash: 'hash', status: 'IN_PROGRESS' }], skipDuplicates: true });
});
