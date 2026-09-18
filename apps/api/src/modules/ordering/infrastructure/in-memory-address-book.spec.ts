import { expect, it } from 'vitest';
import { InMemoryAddressBook } from './in-memory-address-book';

it('should deny ownership when no address persistence is configured', async () => {
  const addresses = new InMemoryAddressBook();
  expect(await addresses.findOwned('customer', 'address')).toBeNull();
  const result = await addresses.findOwned('other', 'address');
  expect(result).toBeNull();
  expect(await addresses.findOwned('customer', 'address')).toBeNull();
});
