import { describe, expect, it } from 'vitest';

import {
  AddressBookPrismaClient,
  CustomerAddressRow,
  PrismaAddressBook,
} from './prisma-address-book';

function row(overrides: Partial<CustomerAddressRow> = {}): CustomerAddressRow {
  return {
    id: 'addr_1',
    customerId: 'cust_1',
    recipientName: 'Nguyễn Văn A',
    phone: '0912345678',
    line1: '123 Lê Lợi',
    line2: null,
    ward: 'Phường Bến Nghé',
    district: 'Quận 1',
    province: 'TP.HCM',
    ...overrides,
  };
}

class FakeAddressBookClient implements AddressBookPrismaClient {
  calls: { where: { id: string; customerId: string } }[] = [];
  stored: CustomerAddressRow | null = row();

  readonly customerAddress = {
    findFirst: async (args: {
      where: { id: string; customerId: string };
    }): Promise<CustomerAddressRow | null> => {
      this.calls.push(args);
      if (!this.stored) return null;
      if (this.stored.id !== args.where.id) return null;
      if (this.stored.customerId !== args.where.customerId) return null;
      return this.stored;
    },
  };
}

function setup() {
  const client = new FakeAddressBookClient();
  const book = new PrismaAddressBook({ current: () => client });
  return { client, book };
}

describe('PrismaAddressBook', () => {
  it('should return the address when it belongs to the customer', async () => {
    const { client, book } = setup();
    client.stored = row({ id: 'addr_1', customerId: 'cust_1' });
    const address = await book.findOwned('cust_1', 'addr_1');
    expect(address).not.toBeNull();
    expect(address?.toJSON().recipientName).toBe('Nguyễn Văn A');
  });

  it('should return null when the address exists but belongs to a different customer', async () => {
    const { client, book } = setup();
    client.stored = row({ id: 'addr_1', customerId: 'cust_owner' });
    const address = await book.findOwned('cust_intruder', 'addr_1');
    expect(address).toBeNull();
    expect(client.calls).toHaveLength(1);
    expect(client.calls[0]?.where).toEqual({ id: 'addr_1', customerId: 'cust_intruder' });
  });

  it('should return null when the address does not exist at all', async () => {
    const { client, book } = setup();
    client.stored = null;
    const address = await book.findOwned('cust_1', 'addr_missing');
    expect(address).toBeNull();
  });

  it('should map every AddressDto field without renaming', async () => {
    const { client, book } = setup();
    client.stored = row({
      recipientName: 'Trần Thị B',
      phone: '0987654321',
      line1: '45 Nguyễn Huệ',
      line2: 'Tầng 2',
      ward: 'Phường Bến Thành',
      district: 'Quận 1',
      province: 'TP.HCM',
    });
    const address = await book.findOwned('cust_1', 'addr_1');
    expect(address?.toJSON()).toEqual({
      recipientName: 'Trần Thị B',
      phone: '0987654321',
      line1: '45 Nguyễn Huệ',
      line2: 'Tầng 2',
      ward: 'Phường Bến Thành',
      district: 'Quận 1',
      province: 'TP.HCM',
    });
  });

  it('should pass null through for an optional line2', async () => {
    const { client, book } = setup();
    client.stored = row({ line2: null });
    const address = await book.findOwned('cust_1', 'addr_1');
    expect(address?.toJSON().line2).toBeNull();
  });

  it('should query by both id and customerId in a single findFirst call', async () => {
    const { client, book } = setup();
    await book.findOwned('cust_1', 'addr_1');
    expect(client.calls).toHaveLength(1);
    expect(client.calls[0]?.where).toEqual({ id: 'addr_1', customerId: 'cust_1' });
  });
});
