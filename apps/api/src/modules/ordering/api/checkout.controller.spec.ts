import { expect, it, vi } from 'vitest';
import { CheckoutController } from './checkout.controller';

it('should fail closed without trusted request.user even when customer headers are supplied', async () => {
  // arrange
  const placeOrder = vi.fn();
  const controller = new CheckoutController({ placeOrder } as never);
  const request = { headers: { 'customer-id': 'customer' } };
  const before = structuredClone(request);
  // confirm
  expect(placeOrder).not.toHaveBeenCalled();
  // act
  const result = controller.placeOrder(request, 'key', {});
  // assert
  await expect(result).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
  expect(request).toEqual(before);
  expect(placeOrder).not.toHaveBeenCalled();
});

it('should reject client supplied customer prices and lot identities', async () => {
  // arrange
  const placeOrder = vi.fn();
  const controller = new CheckoutController({ placeOrder } as never);
  const body = {
    customerId: 'other',
    addressId: 'address',
    currency: 'VND',
    lines: [{ variantId: 'variant', quantity: 1, lotId: 'arbitrary', price: '1' }],
  };
  const before = structuredClone(body);
  // confirm
  expect(placeOrder).not.toHaveBeenCalled();
  // act
  const result = controller.placeOrder({ user: { customerId: 'customer' } }, 'key', body);
  // assert
  await expect(result).rejects.toMatchObject({ code: 'INVALID_CHECKOUT_REQUEST' });
  expect(body).toEqual(before);
  expect(placeOrder).not.toHaveBeenCalled();
});
