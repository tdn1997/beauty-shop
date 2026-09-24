import { MoneyDto } from '../../shared/domain/money';
import { AddressDto } from '../domain/address';
import { Order, OrderStatus } from '../domain/order';

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

/** Aggregate → dữ liệu thuần. Không bao giờ để entity lọt ra ngoài tầng application. */
export function toOrderDto(order: Order): OrderDto {
  return {
    id: order.id,
    customerId: order.customerId,
    status: order.status,
    version: order.version,
    currency: order.currency,
    itemsTotal: order.itemsTotal().toJSON(),
    discountTotal: order.discountTotal().toJSON(),
    shippingFee: order.shippingFee().toJSON(),
    grandTotal: order.grandTotal().toJSON(),
    shippingAddress: order.shippingAddress?.toJSON() ?? null,
    cancellationReason: order.cancellationReason,
    lines: order.lines.map((line) => ({
      variantId: line.variantId,
      sku: line.sku,
      name: line.nameSnapshot,
      unitPrice: line.unitPriceSnapshot.toJSON(),
      quantity: line.quantity,
      subtotal: line.subtotal().toJSON(),
    })),
  };
}
