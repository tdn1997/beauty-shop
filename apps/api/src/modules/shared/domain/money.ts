import { DomainError } from './domain-error';

export type CurrencyCode = 'VND' | 'USD';

const MINOR_UNIT_EXPONENT: Readonly<Record<CurrencyCode, number>> = {
  VND: 0,
  USD: 2,
};

const DECIMAL_PATTERN = /^-?\d+(\.\d+)?$/;

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

  get currency(): CurrencyCode {
    return this.#currency;
  }

  add(other: Money): Money {
    this.#requireSameCurrency(other, 'cộng');
    return new Money(this.#minorUnits + other.#minorUnits, this.#currency);
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
