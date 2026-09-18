'use client';
import Link from 'next/link';
import { useCart } from '@/lib/cart-context';

export default function CartBadge() {
  const { totalItems } = useCart();
  if (totalItems === 0) return null;
  return (
    <Link
      href="/cart"
      style={{
        marginLeft: 'auto',
        fontSize: 14,
        color: '#111',
        textDecoration: 'none',
        padding: '4px 12px',
        borderRadius: 999,
        border: '1px solid #e5e7eb',
        background: '#f9fafb',
      }}
    >
      Giỏ hàng ({totalItems})
    </Link>
  );
}
