import { DomainError } from '../../shared/domain/domain-error';
import { CurrencyCode } from '../../shared/domain/money';
import { Result } from '../../shared/domain/result';
import { PrismaClientSource } from '../../shared/infrastructure/prisma-client-source';
import { OrderRepository } from '../application/order-repository';
import { Order, OrderSnapshot, OrderStatus } from '../domain/order';

/** Hàng trong bảng `order_line`. Tiền là `BIGINT` đơn vị nhỏ nhất, không thập phân. */
export interface OrderLineWriteRow {
  readonly id: string;
  readonly orderId: string;
  readonly variantId: string;
  readonly sku: string;
  readonly nameSnapshot: string;
  readonly unitPrice: bigint;
  readonly quantity: number;
}

/** Hàng trong bảng `sales_order`. Địa chỉ là các cột phẳng — bản chụp, không khoá ngoại. */
export interface SalesOrderWriteRow {
  readonly id: string;
  readonly customerId: string;
  readonly currency: string;
  readonly status: OrderStatus;
  readonly version: number;
  readonly cancellationReason: string | null;
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

/**
 * Đúng phần Prisma mà repository này đụng tới — khai báo hẹp thay vì nhận cả
 * `PrismaClient`. Bề mặt hẹp thì test cắm được bản giả, và đọc file này là biết
 * repository chạm vào những bảng nào.
 */
export interface OrderPrismaClient {
  salesOrder: {
    findUnique(args: {
      where: { id: string };
      include: { lines: true };
    }): Promise<SalesOrderRow | null>;
    create(args: {
      data: SalesOrderWriteRow & { lines: { create: OrderLineWriteRow[] } };
    }): Promise<unknown>;
    updateMany(args: {
      where: { id: string; version: number };
      data: SalesOrderWriteRow;
    }): Promise<{ count: number }>;
  };
  orderLine: {
    deleteMany(args: { where: { orderId: string } }): Promise<{ count: number }>;
    createMany(args: { data: readonly OrderLineWriteRow[] }): Promise<{ count: number }>;
  };
}

/**
 * Cài đặt `OrderRepository` bằng Prisma (GRASP Pure Fabrication: một lớp không
 * có trong ngôn ngữ nghiệp vụ, sinh ra chỉ để gánh việc lưu trữ, nhờ đó
 * `Order` không phải biết bảng biếc gì).
 *
 * Repository **không tự mở transaction**: nó lấy client đang hiệu lực từ
 * `PrismaClientSource`, nên nằm gọn trong ranh giới do ca sử dụng vạch ra.
 */
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
      // Vế `version` này là toàn bộ optimistic lock: nếu ai đó đã ghi đè lên
      // hàng từ lúc ta đọc, phiên bản không còn khớp và không hàng nào bị sửa.
      where: { id: snapshot.id, version: expectedVersion },
      data: toWriteRow(snapshot),
    });

    if (count === 0) {
      // Không đụng tới các dòng đơn: đơn ngoài kia không phải đơn ta đang cầm.
      // Cũng không `markPersisted` — thể hiện này đã lạc hậu, muốn ghi thì
      // phải đọc lại rồi làm lại.
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
    // Khoá chính suy ra từ (đơn, biến thể) thay vì sinh ngẫu nhiên: ghi lại
    // cùng một dòng luôn ra cùng một khoá, khớp với UNIQUE(order_id, variant_id).
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
