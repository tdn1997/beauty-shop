import type { ReactNode } from 'react';
import Link from 'next/link';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside style={{ width: 220, background: '#1a1a2e', color: '#fff', padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 24, color: '#e94560' }}>
          BeautyShop Admin
        </div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <AdminNavLink href="/admin/orders">Đơn hàng</AdminNavLink>
          <AdminNavLink href="/admin/inventory">Kho hàng</AdminNavLink>
        </nav>
        <div style={{ marginTop: 'auto', paddingTop: 16, borderTop: '1px solid #333', fontSize: 13, color: '#888' }}>
          <div>Admin Test</div>
          <div style={{ color: '#555', marginTop: 2 }}>v1.0.0</div>
        </div>
      </aside>
      <main style={{ flex: 1, padding: 32 }}>
        {children}
      </main>
    </div>
  );
}

function AdminNavLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      style={{
        display: 'block',
        padding: '10px 12px',
        borderRadius: 6,
        color: '#ccc',
        textDecoration: 'none',
        fontSize: 14,
      }}
    >
      {children}
    </Link>
  );
}
