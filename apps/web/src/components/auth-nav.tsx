'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';

/** Trang cần phiên đăng nhập — đăng xuất ở đây thì rời về trang chủ. */
const PROTECTED_PREFIXES = ['/admin', '/checkout'];

function initials(name: string): string {
  const words = name.trim().split(/\s+/);
  return ((words.at(-2)?.[0] ?? '') + (words.at(-1)?.[0] ?? '')).toUpperCase();
}

export default function AuthNav() {
  const { user, loading, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  if (loading) return <span className="auth-nav__placeholder" aria-label="Đang kiểm tra phiên" />;
  if (!user) {
    const returnTo = pathname && pathname !== '/login' ? pathname : '/';
    return (
      <Link
        className="btn btn--primary btn--sm"
        href={`/login?returnTo=${encodeURIComponent(returnTo)}`}
      >
        Đăng nhập
      </Link>
    );
  }
  const onSignOut = async () => {
    setBusy(true);
    setFailed(false);
    const ok = await signOut();
    setBusy(false);
    if (!ok) return setFailed(true);
    if (PROTECTED_PREFIXES.some((p) => pathname?.startsWith(p))) router.replace('/');
    router.refresh();
  };
  return (
    <div className="auth-nav">
      {user.role === 'ADMIN' && (
        <Link className="btn btn--ghost btn--sm" href="/admin/orders">
          Admin
        </Link>
      )}
      <span className="user-chip" title={user.email}>
        <span className="user-chip__avatar" aria-hidden="true">
          {initials(user.displayName)}
        </span>
        <span className="user-chip__name">{user.displayName}</span>
      </span>
      <button
        type="button"
        className="btn btn--ghost btn--sm"
        onClick={onSignOut}
        disabled={busy}
        aria-busy={busy || undefined}
      >
        Đăng xuất
      </button>
      {failed && (
        <span className="auth-nav__error" role="alert">
          Không thể đăng xuất, thử lại
        </span>
      )}
    </div>
  );
}
