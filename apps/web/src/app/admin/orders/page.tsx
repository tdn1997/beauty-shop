import { api } from '@/lib/server/api-client';
import { OrdersResponse } from '@/lib/types/admin';
import OrdersTable from './OrdersTable';

// Gọi thẳng API từ server component: api() tự gắn Bearer từ cookie phiên.
// (Tự fetch sang /api/... của chính mình sẽ mất cookie → 401 → bảng rỗng.)
async function fetchOrders(page = 1, limit = 20): Promise<OrdersResponse> {
  const res = await api(`/orders?page=${page}&limit=${limit}`);
  if (!res.ok) return { orders: [], total: 0, page };
  return res.json();
}

export default async function OrdersPage() {
  const data = await fetchOrders(1, 20);
  return <OrdersTable initialData={data} />;
}
