'use client';

import Link from 'next/link';
import { useCart } from '../lib/cart-context';

export default function NavBar() {
  const { totalItems } = useCart();

  return (
    <nav style={{
      background: '#fff',
      borderBottom: '1px solid #e5e5e5',
      padding: '0 24px',
      height: '56px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      <Link href="/" style={{ fontWeight: 700, fontSize: '18px', color: '#d4a373' }}>
        BeautyShop
      </Link>
      <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
        <Link href="/" style={{ fontSize: '14px', fontWeight: 500 }}>Trang chủ</Link>
        <Link href="/cart" style={{ fontSize: '14px', fontWeight: 500, position: 'relative' }}>
          Giỏ hàng
          {totalItems > 0 && (
            <span style={{
              position: 'absolute',
              top: '-8px',
              right: '-16px',
              background: '#d4a373',
              color: '#fff',
              borderRadius: '50%',
              width: '20px',
              height: '20px',
              fontSize: '11px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
            }}>
              {totalItems > 99 ? '99+' : totalItems}
            </span>
          )}
        </Link>
      </div>
    </nav>
  );
}
