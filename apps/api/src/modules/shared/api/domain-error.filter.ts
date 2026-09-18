import { ArgumentsHost, Catch, ConflictException, ExceptionFilter, ForbiddenException, HttpStatus, NotFoundException, UnauthorizedException } from '@nestjs/common';

import { DomainError } from '../domain/domain-error';

interface HttpResponse {
  status(code: number): HttpResponse;
  json(body: unknown): void;
}

const STATUS_BY_CODE: Readonly<Record<string, number>> = {
  UNAUTHENTICATED: HttpStatus.UNAUTHORIZED,
  ADDRESS_NOT_OWNED: HttpStatus.FORBIDDEN,
  VARIANT_NOT_FOUND: HttpStatus.NOT_FOUND,
  CONCURRENT_MODIFICATION: HttpStatus.CONFLICT,
  LOT_EXPIRED: HttpStatus.CONFLICT,
  VARIANT_NOT_SELLABLE: HttpStatus.CONFLICT,
  ORDER_NOT_FOUND: HttpStatus.NOT_FOUND,
  LINE_NOT_FOUND: HttpStatus.NOT_FOUND,
  OUT_OF_STOCK: HttpStatus.CONFLICT,
  LOT_BLOCKED: HttpStatus.CONFLICT,
  INVALID_TRANSITION: HttpStatus.CONFLICT,
  PRICE_CHANGED: HttpStatus.CONFLICT,
  EMPTY_ORDER: HttpStatus.CONFLICT,
  IDEMPOTENCY_KEY_REUSED: HttpStatus.CONFLICT,
  IDEMPOTENCY_IN_PROGRESS: HttpStatus.CONFLICT,
  EMPTY_BASKET: HttpStatus.CONFLICT,
  MISSING_SHIPPING_ADDRESS: HttpStatus.UNPROCESSABLE_ENTITY,
  INVALID_CHECKOUT_REQUEST: HttpStatus.BAD_REQUEST,
};

const NEST_STATUS_BY_CTOR: Readonly<Record<string, number>> = {
  [UnauthorizedException.name]: HttpStatus.UNAUTHORIZED,
  [ForbiddenException.name]: HttpStatus.FORBIDDEN,
  [NotFoundException.name]: HttpStatus.NOT_FOUND,
  [ConflictException.name]: HttpStatus.CONFLICT,
};

@Catch(DomainError)
export class DomainErrorFilter implements ExceptionFilter<DomainError> {
  catch(error: DomainError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<HttpResponse>();
    const status = STATUS_BY_CODE[error.code] ?? HttpStatus.BAD_REQUEST;

    response.status(status).json({
      code: error.code,
      message: error.message,
      details: error.details,
    });
  }
}

@Catch(UnauthorizedException, ForbiddenException, NotFoundException, ConflictException)
export class NestHttpExceptionFilter implements ExceptionFilter {
  catch(error: Error, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<HttpResponse>();
    const status = NEST_STATUS_BY_CTOR[error.constructor.name] ?? HttpStatus.INTERNAL_SERVER_ERROR;

    response.status(status).json({
      code: error.constructor.name,
      message: error.message,
      details: {},
    });
  }
}
