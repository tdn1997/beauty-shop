import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';

import { DomainError } from '../domain/domain-error';

interface HttpResponse {
  status(code: number): HttpResponse;
  json(body: unknown): void;
}

/**
 * Chuyển lỗi nghiệp vụ thành HTTP. Mã lỗi là hợp đồng ổn định với client —
 * client nhánh theo `code`, không bao giờ theo chuỗi message.
 *
 * Lỗi hạ tầng không đi qua đây: chúng thành 500 và được ghi log,
 * vì đó là sự cố hệ thống chứ không phải câu trả lời nghiệp vụ.
 */
const STATUS_BY_CODE: Readonly<Record<string, number>> = {
  ORDER_NOT_FOUND: HttpStatus.NOT_FOUND,
  LINE_NOT_FOUND: HttpStatus.NOT_FOUND,
  OUT_OF_STOCK: HttpStatus.CONFLICT,
  LOT_BLOCKED: HttpStatus.CONFLICT,
  INVALID_TRANSITION: HttpStatus.CONFLICT,
  PRICE_CHANGED: HttpStatus.CONFLICT,
  EMPTY_ORDER: HttpStatus.CONFLICT,
  IDEMPOTENCY_KEY_REUSED: HttpStatus.CONFLICT,
  IDEMPOTENCY_IN_PROGRESS: HttpStatus.CONFLICT,
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
