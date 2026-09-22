'use client';
import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/auth-context';
export default function AuthNav() {
  const { user, loading, refresh } = useAuth();
  if (loading) return <span className="text-muted text-sm" aria-label="Đang kiểm tra phiên" />;
  if (!user)
    return (
      <Link className="btn btn--ghost btn--sm" href="/login">
        Đăng nhập
      </Link>
    );
  return (
    <>
      <span className="text-sm">{user.displayName}</span>
      {user.role === 'ADMIN' && (
        <Link className="btn btn--ghost btn--sm" href="/admin/orders">
          Admin
        </Link>
      )}
      <button
        className="btn btn--ghost btn--sm"
        onClick={async () => {
          const r = await fetch('/api/auth/logout', { method: 'POST' });
          if (r.ok) await refresh();
        }}
      >
        Đăng xuất
      </button>
    </>
  );
}
