export type OrderStatus = 'DRAFT' | 'CONFIRMED' | 'PAID' | 'DISPATCHED' | 'CANCELLED';

export interface MoneyDto {
  readonly amount: string;
  readonly currency: string;
}

export interface AddressDto {
  readonly recipientName: string;
  readonly phone: string;
  readonly line1: string;
  readonly line2?: string;
  readonly ward: string;
  readonly district: string;
  readonly province: string;
  readonly createdAt?: string;
}

export interface OrderLineDto {
  readonly variantId: string;
  readonly sku: string;
  readonly name: string;
  readonly unitPrice: MoneyDto;
  readonly quantity: number;
  readonly subtotal: MoneyDto;
}

export interface OrderDto {
  readonly id: string;
  readonly customerId: string;
  readonly status: OrderStatus;
  readonly version: number;
  readonly currency: string;
  readonly itemsTotal: MoneyDto;
  readonly discountTotal: MoneyDto;
  readonly shippingFee: MoneyDto;
  readonly grandTotal: MoneyDto;
  readonly shippingAddress: AddressDto | null;
  readonly cancellationReason: string | null;
  readonly lines: readonly OrderLineDto[];
}

export interface OrdersResponse {
  readonly orders: readonly OrderDto[];
  readonly total: number;
  readonly page: number;
}

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

export interface InventoryResponse {
  readonly lots: readonly InventoryLotDto[];
  readonly total: number;
  readonly page: number;
}
