import { Body, Controller, Headers, Inject, Post, Req } from '@nestjs/common';
import { Roles } from '../../iam/api/roles.guard';
import { DomainError } from '../../shared/domain/domain-error';
import { CheckoutService } from '../application/checkout.service';
import { validateCheckoutRequest } from './checkout.request';

@Controller('checkout')
export class CheckoutController {
  constructor(@Inject(CheckoutService) private readonly checkout: CheckoutService) {}

  @Post()
  async placeOrder(
    @Req() request: { user?: unknown; headers?: unknown },
    @Headers('idempotency-key') key: string,
    @Body() body: unknown,
  ) {
    const user = request.user;
    if (!user || typeof user !== 'object' || !('customerId' in user) || typeof user.customerId !== 'string' || !user.customerId.trim()) {
      throw new DomainError('UNAUTHENTICATED', 'A trusted principal is required');
    }
    return (await this.checkout.placeOrder({ customerId: user.customerId }, key, validateCheckoutRequest(body))).unwrap();
  }
}
