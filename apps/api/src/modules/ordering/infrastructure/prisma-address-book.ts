import { PrismaClientSource } from '../../shared/infrastructure/prisma-client-source';
import { AddressBook } from '../application/checkout-ports';
import { Address } from '../domain/address';

export interface CustomerAddressRow {
  readonly id: string;
  readonly customerId: string;
  readonly recipientName: string;
  readonly phone: string;
  readonly line1: string;
  readonly line2: string | null;
  readonly ward: string;
  readonly district: string;
  readonly province: string;
}

export interface AddressBookPrismaClient {
  customerAddress: {
    findFirst(args: {
      where: { id: string; customerId: string };
    }): Promise<CustomerAddressRow | null>;
  };
}

/**
 * Cài đặt `AddressBook` bằng Prisma. Quyền sở hữu được ép ngay trong câu
 * truy vấn — `findFirst` lọc bằng cả `id` **và** `customerId` — chứ không
 * đọc theo `id` rồi mới so `customerId` ở tầng ứng dụng. Đây là điều làm
 * cho việc kiểm tra quyền sở hữu thực sự nằm ở mức truy vấn.
 */
export class PrismaAddressBook implements AddressBook {
  readonly #clients: PrismaClientSource<AddressBookPrismaClient>;

  constructor(clients: PrismaClientSource<AddressBookPrismaClient>) {
    this.#clients = clients;
  }

  async findOwned(customerId: string, addressId: string): Promise<Address | null> {
    const row = await this.#clients.current().customerAddress.findFirst({
      where: { id: addressId, customerId },
    });
    if (!row) return null;

    return Address.create({
      recipientName: row.recipientName,
      phone: row.phone,
      line1: row.line1,
      line2: row.line2,
      ward: row.ward,
      district: row.district,
      province: row.province,
    });
  }
}
