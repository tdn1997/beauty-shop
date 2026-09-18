import { Address } from '../domain/address';
import { Result } from '../../shared/domain/result';

export interface AddressBook {
  findOwned(customerId: string, addressId: string): Promise<Address | null>;
}

export interface InventoryAllocation {
  reserveForVariant(variantId: string, quantity: number): Promise<Result<void>>;
}
