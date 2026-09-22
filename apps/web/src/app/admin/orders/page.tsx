import { OrdersResponse } from '@/lib/types/admin';
import OrdersTable from './OrdersTable';

async function fetchOrders(page = 1, limit = 20): Promise<OrdersResponse> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000';
  const res = await fetch(`${baseUrl}/api/orders?page=${page}&limit=${limit}`, {
    cache: 'no-store',
  });
  if (!res.ok) return { orders: [], total: 0, page };
  return res.json();
}

export default async function OrdersPage() {
  const data = await fetchOrders(1, 20);
  return <OrdersTable initialData={data} />;
}
