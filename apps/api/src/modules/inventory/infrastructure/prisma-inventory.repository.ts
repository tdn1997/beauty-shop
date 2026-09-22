import { Clock } from '../../shared/domain/clock';
import { DomainError } from '../../shared/domain/domain-error';
import { requirePositiveInteger } from '../../shared/domain/guards';
import { Result } from '../../shared/domain/result';
import { PrismaClientSource } from '../../shared/infrastructure/prisma-client-source';
import { InventoryLotDto, PaginatedInventoryLots } from '../api/inventory.dto';
import { InventoryRepository } from '../application/inventory-repository';
import { InventoryLot, InventoryLotSnapshot } from '../domain/inventory-lot';

export interface InventoryLotRow {
  readonly id: string;
  readonly variantId: string;
  readonly lotCode: string;
  readonly onHand: number;
  readonly reserved: number;
  readonly expiresOn: Date | null;
  readonly blocked: boolean;
  readonly blockReason: string | null;
  readonly version: number;
}

export interface InventoryPrismaClient {
  $executeRaw(query: TemplateStringsArray, ...values: unknown[]): Promise<number>;
  inventoryLot: {
    findUnique(args: { where: { id: string } }): Promise<InventoryLotRow | null>;
    findMany(args: {
      where: Record<string, unknown>;
      skip: number;
      take: number;
      orderBy: { id: string };
    }): Promise<InventoryLotRow[]>;
    count(args: { where: Record<string, unknown> }): Promise<number>;
  };
}

export class PrismaInventoryRepository implements InventoryRepository {
  readonly #clients: PrismaClientSource<InventoryPrismaClient>;
  readonly #clock: Clock;

  constructor(clients: PrismaClientSource<InventoryPrismaClient>, clock: Clock) {
    this.#clients = clients;
    this.#clock = clock;
  }

  async findById(id: string): Promise<InventoryLot | null> {
    const row = await this.#clients.current().inventoryLot.findUnique({ where: { id } });
    return row ? InventoryLot.rehydrate(toSnapshot(row)) : null;
  }

  async list(
    variantId: string | null,
    page: number,
    limit: number,
  ): Promise<PaginatedInventoryLots> {
    const where = variantId ? { variantId } : {};
    const skip = (page - 1) * limit;
    const [rows, total] = await Promise.all([
      this.#clients.current().inventoryLot.findMany({
        where,
        skip,
        take: limit,
        orderBy: { id: 'asc' },
      }),
      this.#clients.current().inventoryLot.count({ where }),
    ]);

    const lots: InventoryLotDto[] = rows.map((row) => ({
      id: row.id,
      variantId: row.variantId,
      lotCode: row.lotCode,
      onHand: row.onHand,
      reserved: row.reserved,
      available: row.onHand - row.reserved,
      expiresOn: row.expiresOn ? row.expiresOn.toISOString() : null,
      blocked: row.blocked,
      blockReason: row.blockReason,
      version: row.version,
    }));

    return { lots, total };
  }

  async reserve(lotId: string, quantity: number): Promise<Result<void>> {
    requirePositiveInteger(quantity, 'quantity', 'INVALID_QUANTITY');

    const client = this.#clients.current();
    const now = this.#clock.now();

    const affected = await client.$executeRaw`
      UPDATE "inventory_lot"
         SET "reserved" = "reserved" + ${quantity},
             "version" = "version" + 1,
             "updated_at" = now()
       WHERE "id" = ${lotId}
         AND "blocked" = false
         AND "on_hand" - "reserved" >= ${quantity}
         AND ("expires_on" IS NULL OR "expires_on" > ${now})
    `;

    if (affected === 1) return Result.ok(undefined);

    return this.#explainMiss(lotId, quantity);
  }

  async #explainMiss(lotId: string, quantity: number): Promise<Result<void>> {
    const row = await this.#clients.current().inventoryLot.findUnique({ where: { id: lotId } });

    if (!row) {
      return Result.err(new DomainError('LOT_NOT_FOUND', `Không tìm thấy lô ${lotId}`, { lotId }));
    }

    const lot = InventoryLot.rehydrate(toSnapshot(row));

    if (lot.isBlocked()) {
      return Result.err(
        new DomainError('LOT_BLOCKED', `Lô ${lot.lotCode} đang bị khoá`, { lotId }),
      );
    }

    if (lot.isExpiredAt(this.#clock)) {
      return Result.err(
        new DomainError('LOT_EXPIRED', `Lô ${lot.lotCode} đã hết hạn`, {
          lotId,
          expiresOn: lot.expiresOn?.toISOString() ?? null,
        }),
      );
    }

    const available = lot.availableAt(this.#clock);
    if (available < quantity) {
      return Result.err(
        new DomainError('OUT_OF_STOCK', `Lô ${lot.lotCode} không đủ hàng khả dụng`, {
          lotId,
          requested: quantity,
          available,
        }),
      );
    }

    return Result.err(
      new DomainError('CONCURRENT_MODIFICATION', 'Lô hàng vừa bị thay đổi, hãy thử lại', {
        lotId,
        requested: quantity,
      }),
    );
  }
}

function toSnapshot(row: InventoryLotRow): InventoryLotSnapshot {
  return {
    id: row.id,
    variantId: row.variantId,
    lotCode: row.lotCode,
    onHand: row.onHand,
    reserved: row.reserved,
    expiresOn: row.expiresOn,
    blocked: row.blocked,
    blockReason: row.blockReason,
    version: row.version,
  };
}
