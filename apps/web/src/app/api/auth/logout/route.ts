import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { api } from '@/lib/server/api-client';
import { SESSION_COOKIE } from '@/lib/server/session';
export async function POST(req: NextRequest) {
  const allowed = process.env.WEB_ORIGIN ?? req.nextUrl.origin;
  if (req.headers.get('origin') !== allowed)
    return NextResponse.json({ code: 'INVALID_ORIGIN' }, { status: 403 });
  const r = await api('/auth/logout', { method: 'POST' });
  if (!r.ok) return NextResponse.json({ code: 'LOGOUT_FAILED' }, { status: 503 });
  (await cookies()).delete(SESSION_COOKIE);
  return new NextResponse(null, { status: 204, headers: { 'cache-control': 'no-store' } });
}
