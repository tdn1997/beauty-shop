import type { ArgumentsHost } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { DomainError } from '../domain/domain-error';
import { DomainErrorFilter } from './domain-error.filter';

interface CapturedResponse {
  status: number | null;
  body: unknown;
}

function setup() {
  const captured: CapturedResponse = { status: null, body: null };
  const response = {
    status(code: number) {
      captured.status = code;
      return this;
    },
    json(body: unknown) {
      captured.body = body;
    },
  };
  const host = {
    switchToHttp: () => ({ getResponse: () => response }),
  } as unknown as ArgumentsHost;

  return { filter: new DomainErrorFilter(), host, captured };
}

describe('DomainErrorFilter - status mapping', () => {
  it.each([
    ['UNAUTHENTICATED', 401],
    ['ADDRESS_NOT_OWNED', 403],
    ['VARIANT_NOT_FOUND', 404],
    ['CONCURRENT_MODIFICATION', 409],
    ['LOT_EXPIRED', 409],
    ['VARIANT_NOT_SELLABLE', 409],
  ])('should map checkout error %s to %s', (code, status) => {
    const { filter, host, captured } = setup();
    const error = new DomainError(String(code), 'failure');
    const before = { code: error.code, message: error.message, details: error.details };
    expect(captured.status).toBeNull();
    filter.catch(error, host);
    expect(captured.status).toBe(status);
    expect({ code: error.code, message: error.message, details: error.details }).toEqual(before);
  });
  it('should answer 404 when the resource does not exist', () => {
    // arrange
    const { filter, host, captured } = setup();

    // confirm
    expect(captured.status).toBeNull();

    // act
    filter.catch(new DomainError('ORDER_NOT_FOUND', 'Không tìm thấy đơn'), host);

    // assert
    expect(captured.status).toBe(404);
  });

  it('should answer 409 when the business state conflicts', () => {
    // arrange
    const { filter, host, captured } = setup();

    // confirm
    expect(captured.status).toBeNull();

    // act
    filter.catch(new DomainError('OUT_OF_STOCK', 'Hết hàng'), host);

    // assert
    expect(captured.status).toBe(409);
  });

  it('should answer 409 for a forbidden state transition', () => {
    // arrange
    const { filter, host, captured } = setup();

    // confirm
    expect(captured.status).toBeNull();

    // act
    filter.catch(new DomainError('INVALID_TRANSITION', 'Sai trạng thái'), host);

    // assert
    expect(captured.status).toBe(409);
  });

  it('should answer 400 for an unrecognised validation code', () => {
    // arrange
    const { filter, host, captured } = setup();

    // confirm
    expect(captured.status).toBeNull();

    // act
    filter.catch(new DomainError('INVALID_ADDRESS', 'Thiếu trường'), host);

    // assert
    expect(captured.status).toBe(400);
  });
});

describe('DomainErrorFilter - response body', () => {
  it('should return the stable code so clients can branch on it', () => {
    // arrange
    const { filter, host, captured } = setup();

    // confirm
    expect(captured.body).toBeNull();

    // act
    filter.catch(
      new DomainError('OUT_OF_STOCK', 'Lô L2609 không đủ hàng khả dụng', {
        lotId: 'lot_1',
        available: 2,
      }),
      host,
    );

    // assert
    expect(captured.body).toEqual({
      code: 'OUT_OF_STOCK',
      message: 'OUT_OF_STOCK: Lô L2609 không đủ hàng khả dụng',
      details: { lotId: 'lot_1', available: 2 },
    });
  });
});
