import { NextResponse } from 'next/server';
import { api } from '@/lib/server/api-client';
export async function GET() {
  const r = await api('/auth/me');
  return new NextResponse(r.body, {
    status: r.status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}
