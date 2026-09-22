import type { OrderStatus } from '@/lib/types/admin';
import { ORDER_STATUS_LABELS } from '@/lib/format';
import { Badge, type BadgeTone } from './ui/badge';
const tones: Record<OrderStatus, BadgeTone> = {
  DRAFT: 'neutral',
  CONFIRMED: 'info',
  PAID: 'success',
  DISPATCHED: 'info',
  CANCELLED: 'danger',
};
export default function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge tone={tones[status]}>{ORDER_STATUS_LABELS[status]}</Badge>;
}
