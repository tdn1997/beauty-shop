'use client';
import Link from 'next/link';

export default function AdminNav() {
  return (
    <Link
      href="/admin"
      style={{
        marginLeft: 'auto',
        fontSize: 14,
        color: '#6b7280',
        textDecoration: 'none',
        padding: '4px 12px',
        borderRadius: 6,
        border: '1px solid #e5e7eb',
      }}
    >
      Admin
    </Link>
  );
}
