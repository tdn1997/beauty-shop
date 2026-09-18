import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = searchParams.get('page') ?? '1';
  const limit = searchParams.get('limit') ?? '20';
  const apiUrl = process.env.API_URL ?? 'http://localhost:3001';
  const res = await fetch(`${apiUrl}/orders?page=${page}&limit=${limit}`, {
    headers: { 'x-admin-token': 'admin-phase6-token', 'x-user-role': 'admin' },
  });
  if (!res.ok) return NextResponse.json({ error: 'Failed' }, { status: res.status });
  return NextResponse.json(await res.json());
}
