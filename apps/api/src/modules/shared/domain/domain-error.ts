/**
 * Lỗi nghiệp vụ: mã ổn định để tầng api ánh xạ sang HTTP, và để test bám vào.
 * Khác với lỗi hạ tầng (mất kết nối DB, timeout) — những lỗi đó không dùng lớp này.
 */
export class DomainError extends Error {
  readonly #code: string;
  readonly #details: Readonly<Record<string, unknown>>;

  constructor(code: string, message: string, details: Record<string, unknown> = {}) {
    super(`${code}: ${message}`);
    this.name = 'DomainError';
    this.#code = code;
    this.#details = Object.freeze({ ...details });
  }

  get code(): string {
    return this.#code;
  }

  get details(): Readonly<Record<string, unknown>> {
    return this.#details;
  }
}
