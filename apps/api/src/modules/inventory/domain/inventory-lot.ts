import { Clock } from '../../shared/domain/clock';
import { DomainError } from '../../shared/domain/domain-error';
import {
  requireNonBlank,
  requireNonNegativeInteger,
  requirePositiveInteger,
} from '../../shared/domain/guards';

export interface CreateInventoryLotProps {
  readonly id: string;
  readonly variantId: string;
  readonly lotCode: string;
  readonly onHand: number;
  readonly expiresOn?: Date | null;
}

/**
 * Hình dạng lưu trữ của lô hàng — hợp đồng giữa aggregate và repository.
 * Repository dịch snapshot này sang hàng trong bảng, không đọc `#private`.
 */
export interface InventoryLotSnapshot {
  readonly id: string;
  readonly variantId: string;
  readonly lotCode: string;
  readonly onHand: number;
  readonly reserved: number;
  readonly expiresOn: Date | null;
  readonly blocked: boolean;
  readonly blockReason: string | null;
  readonly version: number;
}

/**
 * Lô hàng trong kho. Bất biến cốt lõi: `0 <= reserved <= onHand`.
 *
 * Không có setter nào cho `onHand`/`reserved` — chỉ `reserve` / `release` / `issue`
 * được đụng tới, nên bất biến không thể bị phá từ bên ngoài.
 */
export class InventoryLot {
  readonly #id: string;
  readonly #variantId: string;
  readonly #lotCode: string;
  readonly #expiresOn: Date | null;
  #onHand: number;
  #reserved: number;
  #blocked: boolean;
  #blockReason: string | null;
  #version: number;
  #persistedVersion: number | null;

  private constructor(props: {
    id: string;
    variantId: string;
    lotCode: string;
    onHand: number;
    expiresOn: Date | null;
  }) {
    this.#id = props.id;
    this.#variantId = props.variantId;
    this.#lotCode = props.lotCode;
    this.#expiresOn = props.expiresOn;
    this.#onHand = props.onHand;
    this.#reserved = 0;
    this.#blocked = false;
    this.#blockReason = null;
    this.#version = 0;
    this.#persistedVersion = null;
  }

  static create(props: CreateInventoryLotProps): InventoryLot {
    const id = requireNonBlank(props.id, 'id', 'INVALID_LOT');
    const variantId = requireNonBlank(props.variantId, 'variantId', 'INVALID_LOT');
    const lotCode = requireNonBlank(props.lotCode, 'lotCode', 'INVALID_LOT');
    const onHand = requireNonNegativeInteger(props.onHand, 'onHand', 'INVALID_LOT');
    const expiresOn = props.expiresOn ? new Date(props.expiresOn.getTime()) : null;

    return new InventoryLot({ id, variantId, lotCode, onHand, expiresOn });
  }

  /**
   * Dựng lại lô đã lưu. **Chỉ repository được gọi** — đường duy nhất đặt thẳng
   * `reserved`/`blocked` mà không đi qua `reserve()` / `block()`.
   */
  static rehydrate(snapshot: InventoryLotSnapshot): InventoryLot {
    const lot = new InventoryLot({
      id: requireNonBlank(snapshot.id, 'id', 'INVALID_LOT'),
      variantId: requireNonBlank(snapshot.variantId, 'variantId', 'INVALID_LOT'),
      lotCode: requireNonBlank(snapshot.lotCode, 'lotCode', 'INVALID_LOT'),
      onHand: requireNonNegativeInteger(snapshot.onHand, 'onHand', 'INVALID_LOT'),
      expiresOn: snapshot.expiresOn ? new Date(snapshot.expiresOn.getTime()) : null,
    });

    const reserved = requireNonNegativeInteger(snapshot.reserved, 'reserved', 'INVALID_LOT');
    if (reserved > snapshot.onHand) {
      throw new DomainError('INVALID_LOT', 'Phần đã giữ không được vượt tồn vật lý', {
        lotId: snapshot.id,
        onHand: snapshot.onHand,
        reserved,
      });
    }

    lot.#reserved = reserved;
    lot.#blocked = snapshot.blocked;
    lot.#blockReason = snapshot.blockReason;
    lot.#version = snapshot.version;
    lot.#persistedVersion = snapshot.version;

    return lot;
  }

  get id(): string {
    return this.#id;
  }

  get variantId(): string {
    return this.#variantId;
  }

  get lotCode(): string {
    return this.#lotCode;
  }

  get onHand(): number {
    return this.#onHand;
  }

  get reserved(): number {
    return this.#reserved;
  }

  get version(): number {
    return this.#version;
  }

  /**
   * Phiên bản đang nằm trong DB theo hiểu biết của thể hiện này — `null` nếu
   * lô chưa từng được lưu. Đây là vế `WHERE version = ?` của optimistic lock.
   */
  get persistedVersion(): number | null {
    return this.#persistedVersion;
  }

  /** Trả bản sao: người gọi sửa Date nhận được cũng không đụng tới lô hàng. */
  get expiresOn(): Date | null {
    return this.#expiresOn ? new Date(this.#expiresOn.getTime()) : null;
  }

  isBlocked(): boolean {
    return this.#blocked;
  }

  isExpiredAt(clock: Clock): boolean {
    if (this.#expiresOn === null) return false;
    return clock.now().getTime() >= this.#expiresOn.getTime();
  }

  /** Số lượng thực sự bán được: trừ phần đã giữ, và bằng 0 nếu bị khoá hoặc hết hạn. */
  availableAt(clock: Clock): number {
    if (this.#blocked || this.isExpiredAt(clock)) return 0;
    return this.#onHand - this.#reserved;
  }

  reserve(quantity: number): void {
    requirePositiveInteger(quantity, 'quantity', 'INVALID_QUANTITY');
    if (this.#blocked) {
      throw new DomainError('LOT_BLOCKED', `Lô ${this.#lotCode} đang bị khoá`, { lotId: this.#id });
    }
    if (this.#onHand - this.#reserved < quantity) {
      throw new DomainError('OUT_OF_STOCK', `Lô ${this.#lotCode} không đủ hàng khả dụng`, {
        lotId: this.#id,
        requested: quantity,
        available: this.#onHand - this.#reserved,
      });
    }
    this.#reserved += quantity;
    this.#touch();
  }

  release(quantity: number): void {
    requirePositiveInteger(quantity, 'quantity', 'INVALID_QUANTITY');
    if (quantity > this.#reserved) {
      throw new DomainError('INVALID_RELEASE', 'Không thể nhả nhiều hơn phần đang giữ', {
        lotId: this.#id,
        requested: quantity,
        reserved: this.#reserved,
      });
    }
    this.#reserved -= quantity;
    this.#touch();
  }

  /** Xuất kho phần đã giữ: hàng rời kho thật, `onHand` và `reserved` cùng giảm. */
  issue(quantity: number): void {
    requirePositiveInteger(quantity, 'quantity', 'INVALID_QUANTITY');
    if (quantity > this.#reserved) {
      throw new DomainError('INVALID_ISSUE', 'Không thể xuất nhiều hơn phần đã giữ', {
        lotId: this.#id,
        requested: quantity,
        reserved: this.#reserved,
      });
    }
    this.#reserved -= quantity;
    this.#onHand -= quantity;
    this.#touch();
  }

  unblock(): void {
    this.#blocked = false;
    this.#blockReason = null;
    this.#touch();
  }

  block(reason: string): void {
    this.#blockReason = requireNonBlank(reason, 'reason', 'INVALID_LOT');
    this.#blocked = true;
    this.#touch();
  }

  /** Bản chụp để lưu trữ. `expiresOn` là bản sao: sửa nó không đụng tới lô. */
  toSnapshot(): InventoryLotSnapshot {
    return {
      id: this.#id,
      variantId: this.#variantId,
      lotCode: this.#lotCode,
      onHand: this.#onHand,
      reserved: this.#reserved,
      expiresOn: this.#expiresOn ? new Date(this.#expiresOn.getTime()) : null,
      blocked: this.#blocked,
      blockReason: this.#blockReason,
      version: this.#version,
    };
  }

  /** Repository báo đã ghi xong: `version` hiện tại chính là thứ nằm trong DB. */
  markPersisted(): void {
    this.#persistedVersion = this.#version;
  }

  #touch(): void {
    this.#version += 1;
  }
}
