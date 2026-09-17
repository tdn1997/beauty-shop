import { Clock } from '../../shared/domain/clock';
import { DomainError } from '../../shared/domain/domain-error';
import { requirePositiveInteger } from '../../shared/domain/guards';
import { Result } from '../../shared/domain/result';
import { PrismaClientSource } from '../../shared/infrastructure/prisma-client-source';
import { InventoryRepository } from '../application/inventory-repository';
import { InventoryLot, InventoryLotSnapshot } from '../domain/inventory-lot';

/** Hàng trong bảng `inventory_lot`. */
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

/** Đúng phần Prisma mà repository này đụng tới. */
export interface InventoryPrismaClient {
  $executeRaw(query: TemplateStringsArray, ...values: unknown[]): Promise<number>;
  inventoryLot: {
    findUnique(args: { where: { id: string } }): Promise<InventoryLotRow | null>;
  };
}

/**
 * Cài đặt `InventoryRepository` bằng Prisma.
 *
 * Điểm cốt lõi của lớp này là `reserve`: giữ chỗ được viết thành **một** câu
 * `UPDATE ... WHERE on_hand - reserved >= $1`. Điều kiện nằm ngay trong câu ghi
 * nên Postgres tự khoá hàng và tự so lại tồn tại thời điểm ghi — không có khe
 * nào giữa "đọc thấy còn hàng" và "trừ hàng" để người thứ hai chen vào.
 */
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

  /**
   * Câu lệnh trên không sửa hàng nào — giờ mới đọc để nói cho khách biết *vì sao*.
   *
   * Lần đọc này diễn ra **sau** khi việc ghi đã không xảy ra, nên nó không mở lại
   * khe đọc-rồi-ghi: nó chỉ để chẩn đoán, không có quyết định nào dựa vào nó.
   */
  async #explainMiss(lotId: string, quantity: number): Promise<Result<void>> {
    const row = await this.#clients.current().inventoryLot.findUnique({ where: { id: lotId } });

    if (!row) {
      return Result.err(
        new DomainError('LOT_NOT_FOUND', `Không tìm thấy lô ${lotId}`, { lotId }),
      );
    }

    // Để chính lô hàng trả lời — nó là nơi biết luật khoá / hết hạn / khả dụng.
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

    // Còn đủ hàng mà câu lệnh vẫn trượt: lô đã đổi giữa lúc ghi và lúc đọc này.
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
