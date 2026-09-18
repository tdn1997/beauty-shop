import { AddressBook } from '../application/checkout-ports';
import { Address } from '../domain/address';

export class InMemoryAddressBook implements AddressBook {
  async findOwned(_customerId: string, _addressId: string): Promise<Address | null> {
    return null;
  }
}
