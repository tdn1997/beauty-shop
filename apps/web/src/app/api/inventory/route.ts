import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = searchParams.get('page') ?? '1';
  const limit = searchParams.get('limit') ?? '20';
  const variantId = searchParams.get('variantId') ?? '';
  const apiUrl = process.env.API_URL ?? 'http://localhost:3001';
  const url = `${apiUrl}/inventory/lots?page=${page}&limit=${limit}${variantId ? `&variantId=${variantId}` : ''}`;
  const res = await fetch(url, {
    headers: { 'x-admin-token': 'admin-phase6-token', 'x-user-role': 'admin' },
  });
  if (!res.ok) return NextResponse.json({ error: 'Failed' }, { status: res.status });
  return NextResponse.json(await res.json());
}
