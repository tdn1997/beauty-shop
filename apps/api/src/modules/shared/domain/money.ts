import { DomainError } from './domain-error';
import { requireNonNegativeInteger } from './guards';

export type CurrencyCode = 'VND' | 'USD';

const MINOR_UNIT_EXPONENT: Readonly<Record<CurrencyCode, number>> = {
  VND: 0,
  USD: 2,
};

const DECIMAL_PATTERN = /^-?\d+(\.\d+)?$/;

/** 100% = 10000 điểm cơ bản. */
const BASIS_POINT_SCALE = 10_000n;

export interface MoneyDto {
  readonly amount: string;
  readonly currency: CurrencyCode;
}

/**
 * Value object tiền tệ. Lưu bằng bigint đơn vị nhỏ nhất (xu / đồng) —
 * không bao giờ dùng `number` để tránh sai số dấu phẩy động.
 */
export class Money {
  readonly #minorUnits: bigint;
  readonly #currency: CurrencyCode;

  private constructor(minorUnits: bigint, currency: CurrencyCode) {
    this.#minorUnits = minorUnits;
    this.#currency = currency;
  }

  /** Factory từ chuỗi thập phân, ví dụ `Money.parse('129.50', 'USD')`. */
  static parse(value: string, currency: CurrencyCode): Money {
    if (!DECIMAL_PATTERN.test(value)) {
      throw new DomainError('INVALID_MONEY', `"${value}" không phải số thập phân hợp lệ`, {
        value,
        currency,
      });
    }

    const exponent = MINOR_UNIT_EXPONENT[currency];
    const [whole, fraction = ''] = value.split('.') as [string, string?];

    if (fraction.length > exponent) {
      throw new DomainError(
        'INVALID_MONEY',
        `${currency} chỉ nhận tối đa ${exponent} chữ số thập phân`,
        { value, currency },
      );
    }

    const negative = whole.startsWith('-');
    const digits = (negative ? whole.slice(1) : whole) + fraction.padEnd(exponent, '0');
    const magnitude = BigInt(digits);

    return new Money(negative ? -magnitude : magnitude, currency);
  }

  static zero(currency: CurrencyCode): Money {
    return new Money(0n, currency);
  }

  /**
   * Factory từ đơn vị nhỏ nhất — hình dạng mà tầng lưu trữ giữ.
   * Đi đường này thay vì qua chuỗi thập phân để không phải làm tròn lần nào.
   */
  static fromMinorUnits(minorUnits: bigint, currency: CurrencyCode): Money {
    if (typeof minorUnits !== 'bigint') {
      throw new DomainError('INVALID_MONEY', 'Đơn vị nhỏ nhất phải là bigint', {
        minorUnits: String(minorUnits),
        currency,
      });
    }
    return new Money(minorUnits, currency);
  }

  get currency(): CurrencyCode {
    return this.#currency;
  }

  add(other: Money): Money {
    this.#requireSameCurrency(other, 'cộng');
    return new Money(this.#minorUnits + other.#minorUnits, this.#currency);
  }

  /**
   * Trừ tiền. Kết quả **được phép âm**: `Money` không biết phép trừ này là
   * "còn lại bao nhiêu" hay "hụt bao nhiêu" — chính sách gọi nó mới biết,
   * nên việc chặn số âm thuộc về nơi đó, không thuộc về value object này.
   */
  subtract(other: Money): Money {
    this.#requireSameCurrency(other, 'trừ');
    return new Money(this.#minorUnits - other.#minorUnits, this.#currency);
  }

  /** So sánh cùng tiền tệ: -1 nếu nhỏ hơn, 0 nếu bằng, 1 nếu lớn hơn. */
  compareTo(other: Money): number {
    this.#requireSameCurrency(other, 'so sánh');
    if (this.#minorUnits < other.#minorUnits) return -1;
    if (this.#minorUnits > other.#minorUnits) return 1;
    return 0;
  }

  /** Trần giá trị: nền của bước `min(base)` trong chuỗi tính giảm giá. */
  min(other: Money): Money {
    return this.compareTo(other) <= 0 ? this : other;
  }

  /**
   * Lấy phần trăm theo **điểm cơ bản** (basis points): 1250 = 12.5%.
   *
   * Nhận số nguyên thay vì `0.125` để không có phép chia dấu phẩy động nào
   * chen vào tiền. Phép tính chạy hoàn toàn bằng bigint.
   *
   * Làm tròn: **half-up trên trị tuyệt đối** — phần dư đúng nửa đơn vị nhỏ nhất
   * thì làm tròn ra xa 0 (0.5 → 1, -0.5 → -1), nên dấu không làm lệch kết quả.
   */
  percentage(basisPoints: number): Money {
    requireNonNegativeInteger(basisPoints, 'basisPoints', 'INVALID_BASIS_POINTS');

    const negative = this.#minorUnits < 0n;
    const magnitude = negative ? -this.#minorUnits : this.#minorUnits;
    const scaled = magnitude * BigInt(basisPoints);
    // Cộng nửa mẫu số trước khi chia lấy nguyên chính là half-up.
    const rounded = (scaled + BASIS_POINT_SCALE / 2n) / BASIS_POINT_SCALE;

    return new Money(negative ? -rounded : rounded, this.#currency);
  }

  times(multiplier: number | bigint): Money {
    if (typeof multiplier === 'number' && !Number.isSafeInteger(multiplier)) {
      throw new DomainError('INVALID_MULTIPLIER', 'Hệ số nhân phải là số nguyên', { multiplier });
    }
    return new Money(this.#minorUnits * BigInt(multiplier), this.#currency);
  }

  equals(other: Money): boolean {
    return this.#minorUnits === other.#minorUnits && this.#currency === other.#currency;
  }

  isNegative(): boolean {
    return this.#minorUnits < 0n;
  }

  /** Hình dạng chính xác để lưu xuống DB: không thập phân, không làm tròn. */
  toMinorUnits(): bigint {
    return this.#minorUnits;
  }

  toJSON(): MoneyDto {
    return { amount: this.#formatAmount(), currency: this.#currency };
  }

  toString(): string {
    return `${this.#formatAmount()} ${this.#currency}`;
  }

  #requireSameCurrency(other: Money, operation: string): void {
    if (this.#currency !== other.#currency) {
      throw new DomainError(
        'CURRENCY_MISMATCH',
        `Không thể ${operation} ${this.#currency} với ${other.#currency}`,
        { left: this.#currency, right: other.#currency },
      );
    }
  }

  #formatAmount(): string {
    const exponent = MINOR_UNIT_EXPONENT[this.#currency];
    const negative = this.#minorUnits < 0n;
    const digits = (negative ? -this.#minorUnits : this.#minorUnits).toString();
    const sign = negative ? '-' : '';

    if (exponent === 0) return `${sign}${digits}`;

    const padded = digits.padStart(exponent + 1, '0');
    return `${sign}${padded.slice(0, -exponent)}.${padded.slice(-exponent)}`;
  }
}
