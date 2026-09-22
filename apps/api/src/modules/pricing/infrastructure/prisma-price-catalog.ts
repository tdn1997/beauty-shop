import { CurrencyCode, Money } from '../../shared/domain/money';
import { PrismaClientSource } from '../../shared/infrastructure/prisma-client-source';
import { PriceCatalog, PricedVariant } from '../application/price-catalog';

export interface PricedVariantRow {
  readonly id: string;
  readonly sku: string;
  readonly name: string;
  readonly listPrice: bigint;
  readonly currency: string;
  readonly status: 'ACTIVE' | 'DISCONTINUED';
}

export interface PriceCatalogPrismaClient {
  productVariant: {
    findUnique(args: { where: { id: string } }): Promise<PricedVariantRow | null>;
  };
}

/**
 * Cài đặt `PriceCatalog` bằng Prisma. `sellable` luôn được **suy dẫn** từ
 * `status === 'ACTIVE'`, không đọc cột boolean riêng — cùng quy tắc với
 * `ProductVariant.isSellable()` ở tầng domain của module `catalog`.
 */
export class PrismaPriceCatalog implements PriceCatalog {
  readonly #clients: PrismaClientSource<PriceCatalogPrismaClient>;

  constructor(clients: PrismaClientSource<PriceCatalogPrismaClient>) {
    this.#clients = clients;
  }

  async findVariant(variantId: string): Promise<PricedVariant | null> {
    const row = await this.#clients.current().productVariant.findUnique({
      where: { id: variantId },
    });
    if (!row) return null;

    return {
      variantId: row.id,
      sku: row.sku,
      name: row.name,
      unitPrice: Money.fromMinorUnits(row.listPrice, row.currency as CurrencyCode),
      sellable: row.status === 'ACTIVE',
    };
  }
}
