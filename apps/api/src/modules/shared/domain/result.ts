import { DomainError } from './domain-error';

export interface ResultBranches<T, R> {
  readonly ok: (value: T) => R;
  readonly err: (error: DomainError) => R;
}

/**
 * Kết quả nghiệp vụ **dự kiến** (hết hàng, sai trạng thái, trùng khoá).
 *
 * Quy ước: những tình huống ca sử dụng đã lường trước thì trả `Result`,
 * để lời gọi buộc phải xử lý. `throw` chỉ dành cho vi phạm bất biến —
 * tức là lỗi lập trình, không phải tình huống nghiệp vụ.
 */
export abstract class Result<T> {
  static ok<T>(value: T): Result<T> {
    return new Ok(value);
  }

  static err<T>(error: DomainError): Result<T> {
    return new Err<T>(error);
  }

  abstract isOk(): boolean;
  abstract isErr(): boolean;
  abstract map<U>(transform: (value: T) => U): Result<U>;
  abstract match<R>(branches: ResultBranches<T, R>): R;
  abstract unwrap(): T;
  abstract unwrapOr(fallback: T): T;
  abstract errorOrNull(): DomainError | null;
}

class Ok<T> extends Result<T> {
  readonly #value: T;

  constructor(value: T) {
    super();
    this.#value = value;
  }

  isOk(): boolean {
    return true;
  }

  isErr(): boolean {
    return false;
  }

  map<U>(transform: (value: T) => U): Result<U> {
    return new Ok(transform(this.#value));
  }

  match<R>(branches: ResultBranches<T, R>): R {
    return branches.ok(this.#value);
  }

  unwrap(): T {
    return this.#value;
  }

  unwrapOr(): T {
    return this.#value;
  }

  errorOrNull(): DomainError | null {
    return null;
  }
}

class Err<T> extends Result<T> {
  readonly #error: DomainError;

  constructor(error: DomainError) {
    super();
    this.#error = error;
  }

  isOk(): boolean {
    return false;
  }

  isErr(): boolean {
    return true;
  }

  map<U>(): Result<U> {
    return new Err<U>(this.#error);
  }

  match<R>(branches: ResultBranches<T, R>): R {
    return branches.err(this.#error);
  }

  unwrap(): T {
    throw this.#error;
  }

  unwrapOr(fallback: T): T {
    return fallback;
  }

  errorOrNull(): DomainError | null {
    return this.#error;
  }
}
