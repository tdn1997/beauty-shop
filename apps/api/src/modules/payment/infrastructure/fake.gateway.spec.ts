import { describe, expect, it } from 'vitest';
import { Money } from '../../shared/domain/money';
import { PaymentStatus } from '../domain/payment-status';
import { describePaymentGatewayContract } from '../application/payment-gateway.contract';
import { FakeGateway } from './fake.gateway';

describePaymentGatewayContract('FakeGateway', (status) => ({
  gateway: FakeGateway.deciding(() => status),
}));

const initiation = (orderId: string) => ({
  orderId,
  amount: Money.parse('590000', 'VND'),
  returnUrl: 'https://shop.test/return',
});

describe('FakeGateway', () => {
  it('should approve every payment immediately in approving mode', async () => {
    // arrange
    const gateway = FakeGateway.approving();
    // confirm
    expect(gateway.provider).toBe('fake');
    // act
    const outcome = (await gateway.initiate(initiation('ord_1'))).unwrap();
    // assert
    expect(outcome).toEqual({
      status: PaymentStatus.Paid,
      providerRef: 'fake_ord_1',
      redirectUrl: null,
      reason: null,
    });
  });
  it('should charge an order at most once when initiated again', async () => {
    // arrange
    let decisions = 0;
    const gateway = FakeGateway.deciding(() => {
      decisions += 1;
      return PaymentStatus.Paid;
    });
    const first = (await gateway.initiate(initiation('ord_1'))).unwrap();
    // act
    const again = (await gateway.initiate(initiation('ord_1'))).unwrap();
    // assert
    expect(again).toEqual(first);
    expect(decisions).toBe(1);
  });
  it('should explain a declined payment', async () => {
    // arrange
    const gateway = FakeGateway.deciding(() => PaymentStatus.Failed);
    // act
    const outcome = (await gateway.initiate(initiation('ord_2'))).unwrap();
    // assert
    expect(outcome.status).toBe(PaymentStatus.Failed);
    expect(outcome.reason).toEqual(expect.any(String));
  });
});
