import { Result } from '../../shared/domain/result';
import { InventoryLotDto, PaginatedInventoryLots } from '../api/inventory.dto';
import { InventoryLot } from '../domain/inventory-lot';

export interface InventoryRepository {
  findById(id: string): Promise<InventoryLot | null>;

  list(variantId: string | null, page: number, limit: number): Promise<PaginatedInventoryLots>;

  reserve(lotId: string, quantity: number): Promise<Result<void>>;
}
