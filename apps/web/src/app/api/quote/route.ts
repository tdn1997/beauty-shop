import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const apiUrl = process.env.API_URL ?? 'http://localhost:3001';
  const res = await fetch(`${apiUrl}/quote`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': 'test-customer-1',
      'x-user-role': 'customer',
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
