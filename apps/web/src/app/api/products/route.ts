import { NextResponse } from 'next/server';
export async function GET() {
  const r = await fetch(`${process.env.API_URL ?? 'http://localhost:3001'}/products`, {
    cache: 'no-store',
  });
  return new NextResponse(r.body, {
    status: r.status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}
