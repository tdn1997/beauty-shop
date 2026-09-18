export interface InventoryLotDto {
  readonly id: string;
  readonly variantId: string;
  readonly lotCode: string;
  readonly onHand: number;
  readonly reserved: number;
  readonly available: number;
  readonly expiresOn: string | null;
  readonly blocked: boolean;
  readonly blockReason: string | null;
  readonly version: number;
}

export interface PaginatedInventoryLots {
  readonly lots: InventoryLotDto[];
  readonly total: number;
}

export interface InventoryLotListDto extends PaginatedInventoryLots {
  readonly page: number;
}
