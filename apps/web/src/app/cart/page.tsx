'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCart } from '@/lib/cart-context';
import { formatMoney } from '@/lib/format';

export default function CartPage() {
  const router = useRouter();
  const { cart, updateQuantity, removeItem } = useCart();

  if (cart.items.length === 0) {
    return (
      <main style={{ padding: 24, maxWidth: 600, margin: '0 auto', textAlign: 'center' }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>Giỏ hàng trống</h1>
        <p style={{ color: '#6b7280', marginBottom: 24 }}>Chưa có sản phẩm nào trong giỏ hàng.</p>
        <Link href="/" style={{ color: '#111', fontWeight: 500 }}>← Tiếp tục mua sắm</Link>
      </main>
    );
  }

  const subtotal = cart.items.reduce((sum, item) => sum + parseInt(item.price) * item.quantity, 0);

  return (
    <main style={{ padding: 24, maxWidth: 700, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>Giỏ hàng</h1>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
        {cart.items.map((item) => (
          <div
            key={item.variantId}
            style={{
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              padding: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              background: '#fff',
            }}
          >
            <div style={{ flex: 1 }}>
              <p style={{ fontWeight: 600, margin: 0 }}>{item.name}</p>
              <p style={{ fontSize: 12, color: '#9ca3af', margin: '4px 0 0' }}>
                SKU: {item.sku}
              </p>
              <p style={{ fontSize: 14, margin: '4px 0 0' }}>
                {formatMoney({ amount: item.price, currency: 'VND' })} / cái
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <input
                type="number"
                min={1}
                value={item.quantity}
                onChange={(e) => updateQuantity(item.variantId, parseInt(e.target.value, 10) || 1)}
                style={{ width: 60, padding: '6px 8px', borderRadius: 4, border: '1px solid #d1d5db', textAlign: 'center' }}
              />
              <div style={{ minWidth: 100, textAlign: 'right', fontWeight: 600 }}>
                {formatMoney({ amount: (parseInt(item.price) * item.quantity).toString(), currency: 'VND' })}
              </div>
              <button
                onClick={() => removeItem(item.variantId)}
                style={{ padding: '6px 12px', borderRadius: 4, border: '1px solid #ef4444', background: '#fff', color: '#ef4444', cursor: 'pointer', fontSize: 13 }}
              >
                Xoá
              </button>
            </div>
          </div>
        ))}
      </div>
      <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontSize: 18, fontWeight: 600 }}>Tạm tính:</span>
          <span style={{ fontSize: 20, fontWeight: 700 }}>
            {formatMoney({ amount: subtotal.toString(), currency: 'VND' })}
          </span>
        </div>
        <button
          onClick={() => router.push('/checkout')}
          style={{
            width: '100%',
            padding: '14px 24px',
            borderRadius: 6,
            border: 'none',
            background: '#111',
            color: '#fff',
            fontWeight: 600,
            fontSize: 16,
            cursor: 'pointer',
          }}
        >
          Tiếp tục thanh toán
        </button>
        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <Link href="/" style={{ color: '#6b7280', fontSize: 14 }}>← Tiếp tục mua sắm</Link>
        </div>
      </div>
    </main>
  );
}
