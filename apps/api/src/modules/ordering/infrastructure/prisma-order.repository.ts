import { DomainError } from '../../shared/domain/domain-error';
import { CurrencyCode } from '../../shared/domain/money';
import { Result } from '../../shared/domain/result';
import { PrismaClientSource } from '../../shared/infrastructure/prisma-client-source';
import { OrderRepository, PaginatedOrders } from '../application/order-repository';
import { Order, OrderSnapshot, OrderStatus } from '../domain/order';
import { toOrderDto } from '../application/order.dto';

export interface OrderLineWriteRow {
  readonly id: string;
  readonly orderId: string;
  readonly variantId: string;
  readonly sku: string;
  readonly nameSnapshot: string;
  readonly unitPrice: bigint;
  readonly quantity: number;
}

export interface SalesOrderWriteRow {
  readonly id: string;
  readonly customerId: string;
  readonly currency: string;
  readonly status: OrderStatus;
  readonly version: number;
  readonly cancellationReason: string | null;
  readonly discount: bigint;
  readonly shippingFee: bigint;
  readonly shipRecipientName: string | null;
  readonly shipPhone: string | null;
  readonly shipLine1: string | null;
  readonly shipLine2: string | null;
  readonly shipWard: string | null;
  readonly shipDistrict: string | null;
  readonly shipProvince: string | null;
}

export interface SalesOrderRow extends SalesOrderWriteRow {
  readonly lines: readonly OrderLineWriteRow[];
}

export interface OrderPrismaClient {
  salesOrder: {
    findUnique(args: { where: { id: string }; include: { lines: true } }): Promise<SalesOrderRow | null>;
    create(args: { data: SalesOrderWriteRow & { lines: { create: OrderLineWriteRow[] } } }): Promise<unknown>;
    updateMany(args: { where: { id: string; version: number }; data: SalesOrderWriteRow }): Promise<{ count: number }>;
    findMany(args: { skip: number; take: number; orderBy: { id: string } }): Promise<SalesOrderRow[]>;
    count(): Promise<number>;
  };
  orderLine: {
    deleteMany(args: { where: { orderId: string } }): Promise<{ count: number }>;
    createMany(args: { data: readonly OrderLineWriteRow[] }): Promise<{ count: number }>;
  };
}

export class PrismaOrderRepository implements OrderRepository {
  readonly #clients: PrismaClientSource<OrderPrismaClient>;

  constructor(clients: PrismaClientSource<OrderPrismaClient>) {
    this.#clients = clients;
  }

  async findById(id: string): Promise<Order | null> {
    const row = await this.#clients
      .current()
      .salesOrder.findUnique({ where: { id }, include: { lines: true } });

    return row ? Order.rehydrate(toSnapshot(row)) : null;
  }

  async list(page: number, limit: number): Promise<PaginatedOrders> {
    const skip = (page - 1) * limit;
    const [rows, total] = await Promise.all([
      this.#clients.current().salesOrder.findMany({
        skip,
        take: limit,
        orderBy: { id: 'asc' },
      }),
      this.#clients.current().salesOrder.count(),
    ]);

    const orders = rows.map((row) => toOrderDto(Order.rehydrate(toSnapshot(row))));
    return { orders, total };
  }

  async save(order: Order): Promise<Result<void>> {
    const snapshot = order.toSnapshot();
    const expectedVersion = order.persistedVersion;

    if (expectedVersion === null) {
      await this.#insert(snapshot);
      order.markPersisted();
      return Result.ok(undefined);
    }

    const client = this.#clients.current();
    const { count } = await client.salesOrder.updateMany({
      where: { id: snapshot.id, version: expectedVersion },
      data: toWriteRow(snapshot),
    });

    if (count === 0) {
      return Result.err(
        new DomainError('CONCURRENT_MODIFICATION', 'Đơn đã bị thay đổi bởi một thao tác khác', {
          orderId: snapshot.id,
          expectedVersion,
        }),
      );
    }

    await client.orderLine.deleteMany({ where: { orderId: snapshot.id } });
    if (snapshot.lines.length > 0) {
      await client.orderLine.createMany({ data: toLineRows(snapshot) });
    }

    order.markPersisted();
    return Result.ok(undefined);
  }

  async #insert(snapshot: OrderSnapshot): Promise<void> {
    await this.#clients.current().salesOrder.create({
      data: { ...toWriteRow(snapshot), lines: { create: toLineRows(snapshot) } },
    });
  }
}

function toWriteRow(snapshot: OrderSnapshot): SalesOrderWriteRow {
  const address = snapshot.shippingAddress;
  return {
    id: snapshot.id,
    customerId: snapshot.customerId,
    currency: snapshot.currency,
    status: snapshot.status,
    version: snapshot.version,
    cancellationReason: snapshot.cancellationReason,
    discount: snapshot.discountMinorUnits ?? 0n,
    shippingFee: snapshot.shippingFeeMinorUnits ?? 0n,
    shipRecipientName: address?.recipientName ?? null,
    shipPhone: address?.phone ?? null,
    shipLine1: address?.line1 ?? null,
    shipLine2: address?.line2 ?? null,
    shipWard: address?.ward ?? null,
    shipDistrict: address?.district ?? null,
    shipProvince: address?.province ?? null,
  };
}

function toLineRows(snapshot: OrderSnapshot): OrderLineWriteRow[] {
  return snapshot.lines.map((line) => ({
    id: `${snapshot.id}:${line.variantId}`,
    orderId: snapshot.id,
    variantId: line.variantId,
    sku: line.sku,
    nameSnapshot: line.nameSnapshot,
    unitPrice: line.unitPriceMinorUnits,
    quantity: line.quantity,
  }));
}

function toSnapshot(row: SalesOrderRow): OrderSnapshot {
  const currency = row.currency as CurrencyCode;
  return {
    id: row.id,
    customerId: row.customerId,
    currency,
    status: row.status,
    version: row.version,
    cancellationReason: row.cancellationReason,
    discountMinorUnits: row.discount ?? 0n,
    shippingFeeMinorUnits: row.shippingFee ?? 0n,
    shippingAddress: row.shipRecipientName
      ? {
          recipientName: row.shipRecipientName,
          phone: row.shipPhone ?? '',
          line1: row.shipLine1 ?? '',
          line2: row.shipLine2,
          ward: row.shipWard ?? '',
          district: row.shipDistrict ?? '',
          province: row.shipProvince ?? '',
        }
      : null,
    lines: row.lines.map((line) => ({
      variantId: line.variantId,
      sku: line.sku,
      nameSnapshot: line.nameSnapshot,
      unitPriceMinorUnits: line.unitPrice,
      quantity: line.quantity,
    })),
  };
}
