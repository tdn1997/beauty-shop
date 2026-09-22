import { PaginatedInventoryLots } from '../api/inventory.dto';
import { InventoryRepository } from './inventory-repository';

export class InventoryQueryService {
  constructor(private readonly repository: InventoryRepository) {}

  async listLots(
    variantId: string | null,
    page: number,
    limit: number,
  ): Promise<PaginatedInventoryLots> {
    return this.repository.list(variantId, page, limit);
  }
}
