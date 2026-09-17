import { describe, expect, it } from 'vitest';

import { DomainError } from './domain-error';
import { Result } from './result';

const outOfStock = new DomainError('OUT_OF_STOCK', 'Hết hàng');

describe('Result - carrying a success', () => {
  it('should report success and expose the value', () => {
    // arrange
    const result = Result.ok(42);

    // confirm
    expect(result.isErr()).toBe(false);

    // act
    const isOk = result.isOk();

    // assert
    expect(isOk).toBe(true);
    expect(result.unwrap()).toBe(42);
  });

  it('should transform the value with map', () => {
    // arrange
    const result = Result.ok(21);

    // confirm
    expect(result.unwrap()).toBe(21);

    // act
    const doubled = result.map((value) => value * 2);

    // assert
    expect(doubled.unwrap()).toBe(42);
  });
});

describe('Result - carrying an expected failure', () => {
  it('should report failure and expose the domain error', () => {
    // arrange
    const result = Result.err<number>(outOfStock);

    // confirm
    expect(result.isOk()).toBe(false);

    // act
    const isErr = result.isErr();

    // assert
    expect(isErr).toBe(true);
    expect(result.errorOrNull()?.code).toBe('OUT_OF_STOCK');
  });

  it('should not run map on a failure', () => {
    // arrange
    const result = Result.err<number>(outOfStock);
    let calls = 0;

    // confirm
    expect(calls).toBe(0);

    // act
    result.map((value) => {
      calls += 1;
      return value * 2;
    });

    // assert
    expect(calls).toBe(0);
  });

  it('should throw the carried domain error when unwrapped', () => {
    // arrange
    const result = Result.err<number>(outOfStock);

    // confirm
    expect(result.isErr()).toBe(true);

    // act
    const act = () => result.unwrap();

    // assert
    expect(act).toThrow(DomainError);
    expect(act).toThrow(/OUT_OF_STOCK/);
  });

  it('should fall back to a default value', () => {
    // arrange
    const result = Result.err<number>(outOfStock);

    // confirm
    expect(result.isErr()).toBe(true);

    // act
    const value = result.unwrapOr(0);

    // assert
    expect(value).toBe(0);
  });
});

describe('Result - branching', () => {
  it('should run the ok branch for a success', () => {
    // arrange
    const result = Result.ok('đã đặt');

    // confirm
    expect(result.isOk()).toBe(true);

    // act
    const message = result.match({
      ok: (value) => `thành công: ${value}`,
      err: (error) => `lỗi: ${error.code}`,
    });

    // assert
    expect(message).toBe('thành công: đã đặt');
  });

  it('should run the err branch for a failure', () => {
    // arrange
    const result = Result.err<string>(outOfStock);

    // confirm
    expect(result.isErr()).toBe(true);

    // act
    const message = result.match({
      ok: (value) => `thành công: ${value}`,
      err: (error) => `lỗi: ${error.code}`,
    });

    // assert
    expect(message).toBe('lỗi: OUT_OF_STOCK');
  });

  it('should return null for the error of a success', () => {
    // arrange
    const result = Result.ok(1);

    // confirm
    expect(result.isOk()).toBe(true);

    // act
    const error = result.errorOrNull();

    // assert
    expect(error).toBeNull();
  });
});
