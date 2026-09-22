import { describe, expect, it, vi } from 'vitest';

import { Money } from '../../shared/domain/money';
import { describePaymentGatewayContract } from '../application/payment-gateway.contract';
import { PaymentStatus } from '../domain/payment-status';
import { SandboxGateway, SandboxHttpClient } from './sandbox.gateway';

const initiation = {
  orderId: 'order_1',
  amount: Money.parse('9007199254740993', 'VND'),
  returnUrl: 'https://shop.test/return',
};

function clientReturning(status: number, body: unknown): SandboxHttpClient {
  return {
    post: vi.fn(async () => ({ status, body })),
    get: vi.fn(async () => ({ status, body })),
  };
}

describePaymentGatewayContract('SandboxGateway', (status) => {
  const body = {
    status: status === PaymentStatus.Failed ? 'DECLINED' : status,
    reference: 'sandbox_1',
    redirectUrl: null,
    reason: status === PaymentStatus.Failed ? 'Thẻ bị từ chối' : null,
  };
  return {
    gateway: new SandboxGateway(
      {
        post: async () => ({ status: 200, body }),
        get: async (url) =>
          url.endsWith('/missing') ? { status: 404, body: null } : { status: 200, body },
      },
      'https://sandbox.test',
    ),
  };
});

describe('SandboxGateway - wire mapping', () => {
  it.each([
    [503, { status: 'DECLINED' }],
    [200, 'not-json'],
    [200, { status: 'PAID' }],
    [200, { status: 'unexpected', reference: 'ref_1' }],
  ])('should preserve uncertainty for HTTP %s and malformed responses', async (status, body) => {
    // arrange
    const client = clientReturning(status, body);
    const gateway = new SandboxGateway(client, 'https://sandbox.test');
    // confirm
    expect(initiation.amount.toMinorUnits()).toBe(9007199254740993n);
    // act
    const outcome = (await gateway.initiate(initiation)).unwrap();
    // assert
    expect(outcome.status).toBe(PaymentStatus.Unknown);
    expect(initiation.amount.toMinorUnits()).toBe(9007199254740993n);
  });

  it('should transmit exact decimal strings and encode reference paths', async () => {
    // arrange
    const client = clientReturning(200, {
      status: 'PENDING',
      reference: 'ref/1',
      redirectUrl: 'https://sandbox.test/pay',
      reason: null,
    });
    const gateway = new SandboxGateway(client, 'https://sandbox.test/');
    // confirm
    expect(client.post).not.toHaveBeenCalled();
    // act
    const result = await gateway.initiate(initiation);
    await gateway.query('ref/1');
    // assert
    expect(result.unwrap().redirectUrl).toBe('https://sandbox.test/pay');
    expect(client.post).toHaveBeenCalledWith('https://sandbox.test/payments', {
      orderId: 'order_1',
      amount: '9007199254740993',
      currency: 'VND',
      returnUrl: initiation.returnUrl,
    });
    expect(client.get).toHaveBeenCalledWith('https://sandbox.test/payments/ref%2F1');
  });

  it('should map an initiation timeout to UNKNOWN because money may already have moved', async () => {
    // arrange
    const timeout = Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' });
    const client = clientReturning(200, null);
    client.post = vi.fn(async () => {
      throw timeout;
    });
    const gateway = new SandboxGateway(client, 'https://sandbox.test');
    // confirm
    expect(client.post).not.toHaveBeenCalled();
    // act
    const result = await gateway.initiate(initiation);
    // assert
    expect(result.unwrap().status).toBe(PaymentStatus.Unknown);
    expect(initiation.amount.toMinorUnits()).toBe(9007199254740993n);
  });

  it('should propagate connection failures and query timeouts without changing the request', async () => {
    // arrange
    const failure = new Error('connection lost');
    const timeout = Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' });
    const client: SandboxHttpClient = {
      post: async () => {
        throw failure;
      },
      get: async () => {
        throw timeout;
      },
    };
    const gateway = new SandboxGateway(client, 'https://sandbox.test');
    const before = { ...initiation };
    // confirm
    expect(gateway.provider).toBe('sandbox');
    // act
    const initiate = gateway.initiate(initiation);
    const query = gateway.query('ref_1');
    // assert
    await expect(initiate).rejects.toBe(failure);
    await expect(query).rejects.toBe(timeout);
    expect(initiation).toEqual(before);
  });
});
