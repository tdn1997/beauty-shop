import { Module } from '@nestjs/common';
import { SharedModule } from '../shared/shared.module';
import { PrismaService } from '../shared/infrastructure/prisma.service';
import { CatalogController } from './api/catalog.controller';
import { CATALOG_READER } from './application/catalog-reader';
import { PrismaCatalogReader } from './infrastructure/prisma-catalog.reader';

export { CATALOG_READER };

@Module({
  imports: [SharedModule],
  controllers: [CatalogController],
  providers: [
    {
      provide: CATALOG_READER,
      inject: [PrismaService],
      useFactory: (prisma: PrismaService) => new PrismaCatalogReader(prisma),
    },
  ],
})
export class CatalogModule {}
