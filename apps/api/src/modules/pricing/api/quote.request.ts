import { DomainError } from '../../shared/domain/domain-error';

export interface QuoteLineRequest {
  readonly variantId: string;
  readonly quantity: number;
}

export interface QuoteRequestBody {
  readonly addressId: string;
  readonly lines: QuoteLineRequest[];
}

export function validateQuoteRequestBody(body: unknown): QuoteRequestBody {
  const invalid = () => {
    throw new DomainError(
      'INVALID_CHECKOUT_REQUEST',
      'Expected addressId and non-empty unique lines with positive integer quantities',
    );
  };
  if (!body || typeof body !== 'object' || Array.isArray(body)) return invalid();
  const value = body as Record<string, unknown>;
  if (Object.keys(value).some((key) => !['addressId', 'lines'].includes(key))) return invalid();
  if (typeof value.addressId !== 'string') return invalid();
  if (!Array.isArray(value.lines) || value.lines.length === 0) return invalid();
  const seen = new Set<string>();
  const lines = value.lines.map((line: unknown) => {
    if (!line || typeof line !== 'object' || Array.isArray(line)) return invalid();
    const entry = line as Record<string, unknown>;
    if (Object.keys(entry).some((key) => !['variantId', 'quantity'].includes(key)))
      return invalid();
    if (typeof entry.variantId !== 'string' || !entry.variantId.trim()) return invalid();
    if (
      typeof entry.quantity !== 'number' ||
      !Number.isSafeInteger(entry.quantity) ||
      entry.quantity <= 0 ||
      entry.quantity > 2147483647
    )
      return invalid();
    if (seen.has(entry.variantId)) return invalid();
    seen.add(entry.variantId);
    return { variantId: entry.variantId.trim(), quantity: entry.quantity };
  });
  return { addressId: value.addressId.trim(), lines };
}
