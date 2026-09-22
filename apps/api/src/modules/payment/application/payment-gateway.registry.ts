import { DomainError } from '../../shared/domain/domain-error';
import { requireNonBlank } from '../../shared/domain/guards';
import { PaymentGateway } from './payment-gateway';

/**
 * Nơi duy nhất biết có những cài đặt `PaymentGateway` nào (GRASP Polymorphism +
 * Indirection). Danh sách được nạp ở composition root — `payment.module.ts` —
 * nên ca sử dụng chỉ cầm registry, không `new MockGateway()` ở đâu cả.
 *
 * Tên nhà cung cấp trùng nhau bị chặn ngay lúc dựng: nếu để lọt, cái sau sẽ
 * lặng lẽ che cái trước và tiền sẽ chạy nhầm cổng — hỏng thì rất khó lần ra.
 */
export class PaymentGatewayRegistry {
  readonly #byProvider: ReadonlyMap<string, PaymentGateway>;
  readonly #defaultProvider: string;

  constructor(gateways: readonly PaymentGateway[], defaultProvider: string) {
    const byProvider = new Map<string, PaymentGateway>();

    for (const gateway of gateways) {
      const provider = requireNonBlank(gateway.provider, 'provider', 'INVALID_PAYMENT_GATEWAY');
      if (byProvider.has(provider)) {
        throw new DomainError(
          'PAYMENT_PROVIDER_DUPLICATE',
          `Nhà cung cấp "${provider}" bị đăng ký hai lần`,
          {
            provider,
          },
        );
      }
      byProvider.set(provider, gateway);
    }

    if (!byProvider.has(defaultProvider)) {
      throw new DomainError(
        'PAYMENT_PROVIDER_UNKNOWN',
        `Nhà cung cấp mặc định "${defaultProvider}" chưa được đăng ký`,
        { provider: defaultProvider, registered: [...byProvider.keys()] },
      );
    }

    this.#byProvider = byProvider;
    this.#defaultProvider = defaultProvider;
  }

  for(provider: string): PaymentGateway {
    const gateway = this.#byProvider.get(provider);
    if (!gateway) {
      throw new DomainError('PAYMENT_PROVIDER_UNKNOWN', `Không có cổng thanh toán "${provider}"`, {
        provider,
        registered: [...this.#byProvider.keys()],
      });
    }
    return gateway;
  }

  default(): PaymentGateway {
    return this.for(this.#defaultProvider);
  }

  /** Bản chụp đông cứng: người gọi không nhét thêm nhà cung cấp qua đường này được. */
  providers(): readonly string[] {
    return Object.freeze([...this.#byProvider.keys()]);
  }
}
