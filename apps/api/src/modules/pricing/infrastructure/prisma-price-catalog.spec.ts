import { describe, expect, it } from 'vitest';

import { Money } from '../../shared/domain/money';
import {
  PriceCatalogPrismaClient,
  PricedVariantRow,
  PrismaPriceCatalog,
} from './prisma-price-catalog';

function row(overrides: Partial<PricedVariantRow> = {}): PricedVariantRow {
  return {
    id: 'var_1',
    sku: 'SKU-1',
    name: 'Serum dưỡng ẩm',
    listPrice: 199000n,
    currency: 'VND',
    status: 'ACTIVE',
    product: { status: 'ACTIVE' },
    ...overrides,
  };
}

class FakePriceCatalogClient implements PriceCatalogPrismaClient {
  calls: { where: { id: string } }[] = [];
  stored: PricedVariantRow | null = row();

  readonly productVariant = {
    findUnique: async (args: { where: { id: string } }): Promise<PricedVariantRow | null> => {
      this.calls.push(args);
      return this.stored && this.stored.id === args.where.id ? this.stored : null;
    },
  };
}

function setup() {
  const client = new FakePriceCatalogClient();
  const catalog = new PrismaPriceCatalog({ current: () => client });
  return { client, catalog };
}

describe('PrismaPriceCatalog', () => {
  it('should find a sellable active variant and map it to PricedVariant', async () => {
    const { client, catalog } = setup();
    client.stored = row({ status: 'ACTIVE' });
    const variant = await catalog.findVariant('var_1');
    expect(variant).not.toBeNull();
    expect(variant?.variantId).toBe('var_1');
    expect(variant?.sku).toBe('SKU-1');
    expect(variant?.name).toBe('Serum dưỡng ẩm');
    expect(variant?.sellable).toBe(true);
  });

  it('should map a DISCONTINUED variant with sellable=false', async () => {
    const { client, catalog } = setup();
    client.stored = row({ status: 'DISCONTINUED' });
    const variant = await catalog.findVariant('var_1');
    expect(variant?.sellable).toBe(false);
  });

  it('should return null when no variant matches', async () => {
    const { client, catalog } = setup();
    client.stored = null;
    const variant = await catalog.findVariant('var_missing');
    expect(variant).toBeNull();
  });

  it('should translate minor-unit BigInt price into a Money with the row currency', async () => {
    const { client, catalog } = setup();
    client.stored = row({ listPrice: 250000n, currency: 'VND' });
    const variant = await catalog.findVariant('var_1');
    expect(variant?.unitPrice.equals(Money.fromMinorUnits(250000n, 'VND'))).toBe(true);
    expect(variant?.unitPrice.currency).toBe('VND');
  });

  it('should query by the exact variant id requested', async () => {
    const { client, catalog } = setup();
    await catalog.findVariant('var_1');
    expect(client.calls).toHaveLength(1);
    expect(client.calls[0]?.where).toEqual({ id: 'var_1' });
  });
});
