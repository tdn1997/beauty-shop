import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';

import { TRANSACTIONS } from '../shared/shared.module';
import { PrismaService } from '../shared/infrastructure/prisma.service';
import { CatalogController } from './api/catalog.controller';
import { CATALOG_READER, CatalogModule } from './catalog.module';
import { PrismaCatalogReader } from './infrastructure/prisma-catalog.reader';

describe('CatalogModule', () => {
  it('should resolve CatalogController with a concrete CatalogReader bound to the token', async () => {
    // arrange
    const builder = Test.createTestingModule({ imports: [CatalogModule] })
      .overrideProvider(PrismaService)
      .useValue({
        product: { findMany: async () => [] },
        inventoryLot: { groupBy: async () => [] },
      });

    // confirm
    expect(typeof CATALOG_READER).toBe('symbol');

    // act
    const module = await builder.compile();

    // assert
    expect(module.get(CatalogController)).toBeInstanceOf(CatalogController);
    expect(module.get(CATALOG_READER)).toBeInstanceOf(PrismaCatalogReader);
    await module.close();
  });
});
