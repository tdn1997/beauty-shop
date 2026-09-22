import { IdempotencyRecord, IdempotencyStore } from '../../shared/application/idempotency-store';
import { PrismaClientSource } from '../../shared/infrastructure/prisma-client-source';

type Key = { customerId_key: { customerId: string; key: string } };

export interface CheckoutReplayClient {
  checkoutReplay: {
    findUnique(args: { where: Key }): Promise<IdempotencyRecord | null>;
    createMany(args: {
      data: { customerId: string; key: string; requestHash: string; status: 'IN_PROGRESS' }[];
      skipDuplicates: true;
    }): Promise<{ count: number }>;
    update(args: {
      where: Key;
      data: { status: 'COMPLETED'; response: unknown };
    }): Promise<unknown>;
  };
}

export class PrismaCheckoutReplay implements Pick<
  IdempotencyStore,
  'find' | 'reserve' | 'complete'
> {
  constructor(private readonly clients: PrismaClientSource<CheckoutReplayClient>) {}

  find(customerId: string, key: string): Promise<IdempotencyRecord | null> {
    return this.clients
      .current()
      .checkoutReplay.findUnique({ where: { customerId_key: { customerId, key } } });
  }

  async reserve(customerId: string, key: string, requestHash: string): Promise<boolean> {
    const { count } = await this.clients.current().checkoutReplay.createMany({
      data: [{ customerId, key, requestHash, status: 'IN_PROGRESS' }],
      skipDuplicates: true,
    });
    return count === 1;
  }

  async complete(customerId: string, key: string, response: unknown): Promise<void> {
    await this.clients.current().checkoutReplay.update({
      where: { customerId_key: { customerId, key } },
      data: { status: 'COMPLETED', response: JSON.parse(JSON.stringify(response)) },
    });
  }
}
