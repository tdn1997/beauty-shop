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
  }

  static create(props: CreateInventoryLotProps): InventoryLot {
    const id = requireNonBlank(props.id, 'id', 'INVALID_LOT');
    const variantId = requireNonBlank(props.variantId, 'variantId', 'INVALID_LOT');
    const lotCode = requireNonBlank(props.lotCode, 'lotCode', 'INVALID_LOT');
    const onHand = requireNonNegativeInteger(props.onHand, 'onHand', 'INVALID_LOT');
    const expiresOn = props.expiresOn ? new Date(props.expiresOn.getTime()) : null;

    return new InventoryLot({ id, variantId, lotCode, onHand, expiresOn });
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
  }

  unblock(): void {
    this.#blocked = false;
    this.#blockReason = null;
  }

  block(reason: string): void {
    this.#blockReason = requireNonBlank(reason, 'reason', 'INVALID_LOT');
    this.#blocked = true;
  }
}
