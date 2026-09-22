import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { api } from '@/lib/server/api-client';
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const r = await api('/auth/me');
  if (r.status === 401) redirect('/login?returnTo=%2Fadmin%2Forders');
  if (!r.ok) throw new Error('Không thể xác minh phiên quản trị.');
  const { user } = await r.json();
  if (user.role !== 'ADMIN') redirect('/');
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <strong className="admin-sidebar__brand">Quản trị</strong>
        <nav className="admin-nav">
          <Link className="admin-nav__link" href="/admin/orders">
            Đơn hàng
          </Link>
          <Link className="admin-nav__link" href="/admin/inventory">
            Kho hàng
          </Link>
        </nav>
        <div className="admin-sidebar__footer">{user.displayName}</div>
      </aside>
      <main id="main" className="admin-main">
        {children}
      </main>
    </div>
  );
}
