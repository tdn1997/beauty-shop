import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';

import { PaymentGatewayRegistry } from './application/payment-gateway.registry';
import { PAYMENT_GATEWAY_REGISTRY, PaymentModule } from './payment.module';

describe('PaymentModule', () => {
  it('should export the registry with the fake gateway selected at the composition root', async () => {
    // arrange
    const builder = Test.createTestingModule({ imports: [PaymentModule] });
    // confirm
    expect(typeof PAYMENT_GATEWAY_REGISTRY).toBe('symbol');
    // act
    const module = await builder.compile();
    const registry = module.get<PaymentGatewayRegistry>(PAYMENT_GATEWAY_REGISTRY);
    // assert
    expect(registry.default().provider).toBe('fake');
    expect(registry.providers()).toEqual(['fake', 'mock']);
    await module.close();
  });
});
