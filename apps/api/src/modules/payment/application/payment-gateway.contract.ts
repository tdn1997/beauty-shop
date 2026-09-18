import { describe, expect, it } from 'vitest';

import { Money } from '../../shared/domain/money';
import { PaymentStatus } from '../domain/payment-status';
import { PaymentGateway } from './payment-gateway';

export interface PaymentGatewayContractHarness {
  readonly gateway: PaymentGateway;
}

export function describePaymentGatewayContract(
  name: string,
  createGateway: (status: PaymentStatus) => PaymentGatewayContractHarness,
): void {
  describe(`${name} - PaymentGateway contract`, () => {
    for (const status of Object.values(PaymentStatus)) {
      it(`should preserve ${status} through initiation and query`, async () => {
        // arrange
        const { gateway } = createGateway(status);
        const initiation = { orderId: 'order_1', amount: Money.parse('9007199254740993', 'VND'), returnUrl: 'https://shop.test/return' };
        // confirm
        expect(initiation.amount.toMinorUnits()).toBe(9007199254740993n);
        // act
        const result = await gateway.initiate(initiation);
        const outcome = result.unwrap();
        const queried = await gateway.query(outcome.providerRef!);
        // assert
        expect(result.isOk()).toBe(true);
        expect(outcome.providerRef).toEqual(expect.any(String));
        expect(outcome.status).toBe(status);
        expect(queried.unwrap().status).toBe(status);
        expect(initiation.amount.toMinorUnits()).toBe(9007199254740993n);
      });
    }

    it('should return a stable error for an unknown reference without changing existing outcomes', async () => {
      // arrange
      const { gateway } = createGateway(PaymentStatus.Paid);
      const outcome = (await gateway.initiate({ orderId: 'order_1', amount: Money.parse('1', 'VND'), returnUrl: 'https://shop.test/return' })).unwrap();
      // confirm
      expect(outcome.status).toBe(PaymentStatus.Paid);
      // act
      const result = await gateway.query('missing');
      // assert
      expect(result.errorOrNull()?.code).toBe('PAYMENT_REF_NOT_FOUND');
      expect((await gateway.query(outcome.providerRef!)).unwrap()).toEqual(outcome);
    });

    it('should reject negative amounts without consuming a payment', async () => {
      // arrange
      const { gateway } = createGateway(PaymentStatus.Paid);
      const initiation = { orderId: 'order_1', amount: Money.parse('-1', 'VND'), returnUrl: 'https://shop.test/return' };
      // confirm
      expect(initiation.amount.isNegative()).toBe(true);
      // act
      const result = await gateway.initiate(initiation);
      // assert
      expect(result.errorOrNull()?.code).toBe('PAYMENT_AMOUNT_INVALID');
      expect(initiation.amount.toMinorUnits()).toBe(-1n);
      expect((await gateway.initiate({ ...initiation, amount: Money.parse('1', 'VND') })).unwrap().status).toBe(PaymentStatus.Paid);
    });
  });
}
