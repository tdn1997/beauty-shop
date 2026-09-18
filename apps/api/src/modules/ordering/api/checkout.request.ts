import { DomainError } from '../../shared/domain/domain-error';
import { CheckoutRequest } from '../application/checkout.service';

export function validateCheckoutRequest(body: unknown): CheckoutRequest {
  const invalid = () => { throw new DomainError('INVALID_CHECKOUT_REQUEST', 'Expected addressId, VND currency and unique variant quantities'); };
  if (!body || typeof body !== 'object' || Array.isArray(body)) return invalid();
  const value = body as Record<string, unknown>;
  if (Object.keys(value).some((key) => !['addressId', 'currency', 'lines'].includes(key))) return invalid();
  if (typeof value.addressId !== 'string' || !value.addressId.trim() || value.currency !== 'VND' || !Array.isArray(value.lines) || value.lines.length === 0 || value.lines.length > 100) return invalid();
  const seen = new Set<string>();
  const lines = value.lines.map((line: unknown) => {
    if (!line || typeof line !== 'object' || Array.isArray(line)) return invalid();
    const entry = line as Record<string, unknown>;
    if (Object.keys(entry).some((key) => !['variantId', 'quantity'].includes(key)) || typeof entry.variantId !== 'string' || !entry.variantId.trim() || typeof entry.quantity !== 'number' || !Number.isSafeInteger(entry.quantity) || entry.quantity <= 0 || entry.quantity > 2147483647 || seen.has(entry.variantId)) return invalid();
    seen.add(entry.variantId);
    return { variantId: entry.variantId, quantity: entry.quantity };
  });
  return { addressId: value.addressId, currency: 'VND', lines };
}
