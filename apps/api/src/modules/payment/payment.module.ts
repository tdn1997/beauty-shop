import { Module } from '@nestjs/common';

import { PaymentGatewayRegistry } from './application/payment-gateway.registry';
import { MockGateway } from './infrastructure/mock.gateway';

export const PAYMENT_GATEWAY_REGISTRY = Symbol('PaymentGatewayRegistry');

@Module({
  providers: [
    {
      provide: PAYMENT_GATEWAY_REGISTRY,
      // Khi đã cắm client sandbox vào danh sách, đổi mặc định thành 'sandbox' chỉ sửa một dòng ở đây; ca sử dụng không đổi.
      useFactory: () => new PaymentGatewayRegistry([MockGateway.scripted([])], 'mock'),
    },
  ],
  exports: [PAYMENT_GATEWAY_REGISTRY],
})
export class PaymentModule {}
