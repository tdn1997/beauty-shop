import { api } from '@/lib/server/api-client';
import { InventoryResponse } from '@/lib/types/admin';
import InventoryTable from './InventoryTable';

// Gọi thẳng API từ server component: api() tự gắn Bearer từ cookie phiên.
// (Tự fetch sang /api/... của chính mình sẽ mất cookie → 401 → bảng rỗng.)
async function fetchInventory(page = 1, limit = 20): Promise<InventoryResponse> {
  const res = await api(`/inventory/lots?page=${page}&limit=${limit}`);
  if (!res.ok) return { lots: [], total: 0, page };
  return res.json();
}

export default async function InventoryPage() {
  const data = await fetchInventory(1, 20);
  return <InventoryTable initialData={data} />;
}
