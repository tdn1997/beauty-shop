import 'server-only';
import { cookies } from 'next/headers';
export const SESSION_COOKIE =
  process.env.NODE_ENV === 'production' ? '__Host-beautyshop_session' : 'beautyshop_session';
export async function token() {
  return (await cookies()).get(SESSION_COOKIE)?.value ?? '';
}
export function safeReturnPath(value: string | null) {
  if (!value) return '/';
  try {
    const decoded = decodeURIComponent(value);
    if (
      !decoded.startsWith('/') ||
      decoded.startsWith('//') ||
      decoded.includes('\\') ||
      decoded.includes('\0')
    )
      return '/';
    return decoded;
  } catch {
    return '/';
  }
}
