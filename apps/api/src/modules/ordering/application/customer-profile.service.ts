import { DomainError } from '../../shared/domain/domain-error';
import type { QuoteService } from '../../pricing/application/quote.service';
import type { AddressBook } from './checkout-ports';
export interface AddressListItem {
  id: string;
  recipientName: string;
  phone: string;
  line1: string;
  line2: string | null;
  ward: string;
  district: string;
  province: string;
}
export interface AddressReader {
  listOwned(customerId: string): Promise<AddressListItem[]>;
}
export class CustomerProfileService {
  constructor(
    private readonly reader: AddressReader,
    private readonly book: AddressBook,
    private readonly quotes: QuoteService,
  ) {}
  listAddresses(customerId: string) {
    return this.reader.listOwned(customerId);
  }
  async quote(
    customerId: string,
    input: { addressId: string; lines: { variantId: string; quantity: number }[] },
  ) {
    const address = await this.book.findOwned(customerId, input.addressId);
    if (!address)
      throw new DomainError('ADDRESS_NOT_OWNED', 'Address is not available to this customer');
    return (
      await this.quotes.quoteFor({
        customerId,
        currency: 'VND',
        province: address.toJSON().province,
        lines: input.lines,
      })
    )
      .unwrap()
      .toDto();
  }
}
