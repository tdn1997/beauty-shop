import { describe, expect, it } from 'vitest';

import { Result } from '../../shared/domain/result';
import { PaymentStatus } from '../domain/payment-status';
import { PaymentGateway, PaymentOutcome } from './payment-gateway';
import { PaymentGatewayRegistry } from './payment-gateway.registry';

/**
 * Cổng giả tối giản — registry chỉ quan tâm tên nhà cung cấp, không gọi gì cả.
 * Nó nằm ở đây thay vì import `MockGateway`: registry thuộc tầng application,
 * và test này phải chứng minh nó không cần biết cài đặt nào tồn tại.
 */
function gatewayNamed(provider: string): PaymentGateway {
  const outcome: PaymentOutcome = {
    status: PaymentStatus.Paid,
    providerRef: `${provider}_ref`,
    redirectUrl: null,
    reason: null,
  };
  return {
    provider,
    initiate: async () => Result.ok(outcome),
    query: async () => Result.ok(outcome),
  };
}

describe('PaymentGatewayRegistry - chọn cổng', () => {
  it('should hand back the gateway registered under a provider name', () => {
    // arrange
    const sandbox = gatewayNamed('sandbox');
    const registry = new PaymentGatewayRegistry([gatewayNamed('mock'), sandbox], 'mock');

    // confirm
    expect(registry.providers()).toContain('sandbox');

    // act
    const chosen = registry.for('sandbox');

    // assert
    expect(chosen).toBe(sandbox);
  });

  it('should hand back the default gateway when no provider is named', () => {
    // arrange
    const mock = gatewayNamed('mock');
    const registry = new PaymentGatewayRegistry([mock, gatewayNamed('sandbox')], 'mock');

    // confirm
    expect(registry.providers()).toHaveLength(2);

    // act
    const chosen = registry.default();

    // assert
    expect(chosen).toBe(mock);
  });

  it('should list the registered providers in registration order', () => {
    // arrange
    const registry = new PaymentGatewayRegistry(
      [gatewayNamed('mock'), gatewayNamed('sandbox')],
      'mock',
    );

    // confirm
    expect(registry.default().provider).toBe('mock');

    // act
    const providers = registry.providers();

    // assert
    expect(providers).toEqual(['mock', 'sandbox']);
  });

  it('should hand back a frozen provider list so callers cannot register behind its back', () => {
    // arrange
    const registry = new PaymentGatewayRegistry([gatewayNamed('mock')], 'mock');

    // confirm
    expect(registry.providers()).toEqual(['mock']);

    // act
    const providers = registry.providers();

    // assert
    expect(Object.isFrozen(providers)).toBe(true);
    expect(() => (providers as string[]).push('sandbox')).toThrow();
    expect(registry.providers()).toEqual(['mock']);
  });

  it('should reject an unknown provider with a stable code', () => {
    // arrange
    const registry = new PaymentGatewayRegistry([gatewayNamed('mock')], 'mock');

    // confirm
    expect(registry.providers()).toEqual(['mock']);

    // act
    const act = () => registry.for('vnpay');

    // assert
    expect(act).toThrow(/PAYMENT_PROVIDER_UNKNOWN/);
    expect(registry.providers()).toEqual(['mock']);
  });
});

describe('PaymentGatewayRegistry - dựng registry sai', () => {
  it('should reject two gateways claiming the same provider name', () => {
    // arrange
    const gateways = [gatewayNamed('mock'), gatewayNamed('mock')];

    // confirm
    expect(gateways).toHaveLength(2);

    // act
    const act = () => new PaymentGatewayRegistry(gateways, 'mock');

    // assert
    expect(act).toThrow(/PAYMENT_PROVIDER_DUPLICATE/);
  });

  it('should reject a default that was never registered', () => {
    // arrange
    const gateways = [gatewayNamed('mock')];

    // confirm
    expect(() => new PaymentGatewayRegistry(gateways, 'mock')).not.toThrow();

    // act
    const act = () => new PaymentGatewayRegistry(gateways, 'sandbox');

    // assert
    expect(act).toThrow(/PAYMENT_PROVIDER_UNKNOWN/);
  });

  it('should reject an empty registry', () => {
    // arrange
    const gateways: PaymentGateway[] = [];

    // confirm
    expect(gateways).toHaveLength(0);

    // act
    const act = () => new PaymentGatewayRegistry(gateways, 'mock');

    // assert
    expect(act).toThrow(/PAYMENT_PROVIDER_UNKNOWN/);
  });

  it('should reject a gateway with a blank provider name', () => {
    // arrange
    const gateways = [gatewayNamed('  ')];

    // confirm
    expect(gateways).toHaveLength(1);

    // act
    const act = () => new PaymentGatewayRegistry(gateways, 'mock');

    // assert
    expect(act).toThrow(/INVALID_PAYMENT_GATEWAY/);
  });
});
