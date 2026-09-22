import { Controller, Get, Inject } from '@nestjs/common';
import { Public } from '../../iam/api/auth.guard';
import { CATALOG_READER, type CatalogReader } from '../application/catalog-reader';

@Controller('products')
export class CatalogController {
  constructor(@Inject(CATALOG_READER) private readonly reader: CatalogReader) {}

  @Public()
  @Get()
  list() {
    return this.reader.listPublic(new Date());
  }
}
