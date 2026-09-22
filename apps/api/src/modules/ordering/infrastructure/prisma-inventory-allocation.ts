import { InventoryRepository } from '../../inventory/application/inventory-repository';
import { Clock } from '../../shared/domain/clock';
import { DomainError } from '../../shared/domain/domain-error';
import { requirePositiveInteger } from '../../shared/domain/guards';
import { Result } from '../../shared/domain/result';
import { PrismaClientSource } from '../../shared/infrastructure/prisma-client-source';
import { InventoryAllocation } from '../application/checkout-ports';

export interface AllocationClient {
  inventoryLot: {
    findMany(args: {
      where: {
        variantId: string;
        blocked: false;
        OR: [{ expiresOn: null }, { expiresOn: { gt: Date } }];
      };
      orderBy: [{ expiresOn: 'asc' }, { id: 'asc' }];
      select: { id: true; onHand: true; reserved: true };
    }): Promise<readonly { id: string; onHand: number; reserved: number }[]>;
  };
}

export class PrismaInventoryAllocation implements InventoryAllocation {
  constructor(
    private readonly clients: PrismaClientSource<AllocationClient>,
    private readonly inventory: Pick<InventoryRepository, 'reserve'>,
    private readonly clock: Clock,
  ) {}

  async reserveForVariant(variantId: string, quantity: number): Promise<Result<void>> {
    requirePositiveInteger(quantity, 'quantity', 'INVALID_QUANTITY');
    const lots = await this.clients.current().inventoryLot.findMany({
      where: {
        variantId,
        blocked: false,
        OR: [{ expiresOn: null }, { expiresOn: { gt: this.clock.now() } }],
      },
      orderBy: [{ expiresOn: 'asc' }, { id: 'asc' }],
      select: { id: true, onHand: true, reserved: true },
    });
    if (lots.reduce((sum, lot) => sum + Math.max(0, lot.onHand - lot.reserved), 0) < quantity) {
      return Result.err(
        new DomainError('OUT_OF_STOCK', 'Insufficient available inventory', { variantId }),
      );
    }
    let remaining = quantity;
    for (const lot of lots) {
      const allocated = Math.min(remaining, Math.max(0, lot.onHand - lot.reserved));
      if (allocated === 0) continue;
      const reserved = await this.inventory.reserve(lot.id, allocated);
      if (reserved.isErr()) return reserved;
      remaining -= allocated;
      if (remaining === 0) break;
    }
    return Result.ok(undefined);
  }
}
