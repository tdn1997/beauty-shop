import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { expect, it } from 'vitest';
import { OrderingModule } from './ordering.module';
import { CheckoutService } from './application/checkout.service';
import { CheckoutController } from './api/checkout.controller';

it('should compose checkout with fail closed address ownership', async () => {
  const module = await Test.createTestingModule({ imports: [OrderingModule] }).compile();
  const checkout = module.get(CheckoutService);
  expect(module.get(CheckoutController)).toBeInstanceOf(CheckoutController);
  const result = await checkout.placeOrder({ customerId: 'customer' }, 'key', { addressId: 'address', currency: 'VND', lines: [{ variantId: 'variant', quantity: 1 }] });
  expect(result.errorOrNull()?.code).toBe('ADDRESS_NOT_OWNED');
  await module.close();
});
