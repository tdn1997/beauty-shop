import {
  BadRequestException,
  CallHandler,
  ConflictException,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, firstValueFrom, of } from 'rxjs';

import { IdempotencyService } from '../application/idempotency.service';
import { IDEMPOTENT_METADATA_KEY } from './idempotency.decorator';

interface RequestWithPrincipal {
  readonly headers: Record<string, string | string[] | undefined>;
  readonly body: unknown;
  readonly user?: { readonly id: string };
}

/**
 * Lớp vỏ HTTP mỏng quanh `IdempotencyService`: đọc header, lấy principal,
 * rồi ánh xạ lỗi nghiệp vụ sang mã HTTP. Không có quy tắc nghiệp vụ nào ở đây.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  readonly #reflector: Reflector;
  readonly #idempotency: IdempotencyService;

  constructor(reflector: Reflector, idempotency: IdempotencyService) {
    this.#reflector = reflector;
    this.#idempotency = idempotency;
  }

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const isIdempotent = this.#reflector.getAllAndOverride<boolean>(IDEMPOTENT_METADATA_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!isIdempotent) return next.handle();

    const request = context.switchToHttp().getRequest<RequestWithPrincipal>();
    const key = request.headers['idempotency-key'];

    if (typeof key !== 'string' || key.trim() === '') {
      throw new BadRequestException('Thiếu header Idempotency-Key');
    }

    const customerId = request.user?.id;
    if (!customerId) {
      throw new UnauthorizedException('Yêu cầu chưa xác định được khách hàng');
    }

    const result = await this.#idempotency.run({ customerId, key, body: request.body }, async () =>
      firstValueFrom(next.handle()),
    );

    return result.match({
      ok: (response) => of(response),
      err: (error) => {
        throw new ConflictException({ code: error.code, message: error.message });
      },
    });
  }
}
