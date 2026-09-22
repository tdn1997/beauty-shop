export interface MoneyDto {
  readonly amount: string;
  readonly currency: string;
}

export function formatMoney(dto: MoneyDto): string {
  if (dto.currency === 'VND') {
    const num = parseInt(dto.amount, 10);
    return num.toLocaleString('vi-VN') + ' đ';
  }
  if (dto.currency === 'USD') {
    const num = parseFloat(dto.amount);
    return '$' + num.toFixed(2);
  }
  return `${dto.amount} ${dto.currency}`;
}

export function formatDate(isoString: string | null): string {
  if (!isoString) return '—';
  const date = new Date(isoString);
  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDateOnly(isoString: string | null): string {
  if (!isoString) return '—';
  const date = new Date(isoString);
  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export const ORDER_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Nháp',
  CONFIRMED: 'Đã xác nhận',
  PAID: 'Đã thanh toán',
  DISPATCHED: 'Đã giao',
  CANCELLED: 'Đã huỷ',
};

export function getShippingStatusLabel(status: string): string {
  switch (status) {
    case 'DRAFT':
      return '—';
    case 'CONFIRMED':
      return 'Chưa giao';
    case 'PAID':
      return 'Đã thanh toán';
    case 'DISPATCHED':
      return 'Đã giao';
    case 'CANCELLED':
      return 'Đã huỷ';
    default:
      return status;
  }
}
