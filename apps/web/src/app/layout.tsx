import type { ReactNode } from 'react';
import { CartProvider } from '@/lib/cart-context';
import AdminNav from './AdminNav';
import CartBadge from '@/components/cart-badge';

export const metadata = {
  title: 'BeautyShop',
  description: 'Cửa hàng mỹ phẩm',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi">
      <body>
        <CartProvider>
          <header style={{ borderBottom: '1px solid #e5e7eb', padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 24 }}>
            <a href="/" style={{ fontSize: 18, fontWeight: 700, textDecoration: 'none', color: '#111' }}>
              BeautyShop
            </a>
            <CartBadge />
            <AdminNav />
          </header>
          {children}
        </CartProvider>
      </body>
    </html>
  );
}
