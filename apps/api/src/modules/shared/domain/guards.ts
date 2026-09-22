import { DomainError } from './domain-error';

/** Tiền điều kiện dùng chung, đặt ở đầu thân hàm để hợp đồng của method hiện rõ. */

export function requireNonBlank(value: string, field: string, code: string): string {
  const trimmed = value?.trim() ?? '';
  if (trimmed === '') {
    throw new DomainError(code, `Thiếu trường "${field}"`, { field });
  }
  return trimmed;
}

export function requirePositiveInteger(value: number, field: string, code: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new DomainError(code, `"${field}" phải là số nguyên dương`, { field, value });
  }
  return value;
}

export function requireNonNegativeInteger(value: number, field: string, code: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new DomainError(code, `"${field}" phải là số nguyên không âm`, { field, value });
  }
  return value;
}

/** Tiền điều kiện cho máy trạng thái: chỉ những trạng thái liệt kê mới được phép hành động. */
export function requireState<S extends string>(
  current: S,
  allowed: readonly S[],
  action: string,
): void {
  if (!allowed.includes(current)) {
    throw new DomainError(
      'INVALID_TRANSITION',
      `Không thể "${action}" khi đang ở trạng thái ${current}`,
      { action, current, allowed: [...allowed] },
    );
  }
}
