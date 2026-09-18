import { describe, expect, it } from 'vitest';
import { Money } from '../../shared/domain/money';
import { PaymentStatus } from '../domain/payment-status';
import { describePaymentGatewayContract } from '../application/payment-gateway.contract';
import { MockGateway } from './mock.gateway';

describePaymentGatewayContract('MockGateway', (status) => ({ gateway: MockGateway.scripted([status]) }));

const initiation = { orderId: 'order_1', amount: Money.parse('1', 'VND'), returnUrl: 'https://shop.test/return' };

describe('MockGateway - scripts', () => {
  it('should follow the script with deterministic references then report uncertainty on exhaustion', async () => {
    // arrange
    const gateway = MockGateway.scripted([PaymentStatus.Paid, PaymentStatus.Failed, PaymentStatus.Unknown]);
    // confirm
    expect(gateway.provider).toBe('mock');
    // act
    const outcomes = [];
    for (let index = 0; index < 4; index += 1) outcomes.push((await gateway.initiate(initiation)).unwrap());
    // assert
    expect(outcomes.map((outcome) => outcome.status)).toEqual([PaymentStatus.Paid, PaymentStatus.Failed, PaymentStatus.Unknown, PaymentStatus.Unknown]);
    expect(outcomes.map((outcome) => outcome.providerRef)).toEqual(['mock_1', 'mock_2', 'mock_3', 'mock_4']);
  });

  it('should propagate a scripted infrastructure fault without altering previous payments', async () => {
    // arrange
    const fault = new Error('network down');
    const gateway = MockGateway.scripted([PaymentStatus.Paid, fault, PaymentStatus.Failed]);
    const before = (await gateway.initiate(initiation)).unwrap();
    // confirm
    expect(before.providerRef).toBe('mock_1');
    // act
    const act = gateway.initiate(initiation);
    // assert
    await expect(act).rejects.toBe(fault);
    expect((await gateway.query('mock_1')).unwrap()).toEqual(before);
    expect((await gateway.initiate(initiation)).unwrap().status).toBe(PaymentStatus.Failed);
  });
});
