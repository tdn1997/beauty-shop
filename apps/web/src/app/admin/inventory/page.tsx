import { InventoryResponse } from '@/lib/types/admin';
import InventoryTable from './InventoryTable';

async function fetchInventory(page = 1, limit = 20): Promise<InventoryResponse> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000';
  const res = await fetch(`${baseUrl}/api/inventory?page=${page}&limit=${limit}`, {
    cache: 'no-store',
  });
  if (!res.ok) {
    return { lots: [], total: 0, page };
  }
  return res.json();
}

export default async function InventoryPage() {
  const data = await fetchInventory(1, 20);
  return <InventoryTable initialData={data} />;
}
