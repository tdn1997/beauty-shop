'use client';
import { useRouter } from 'next/navigation';
import { useCart } from '@/lib/cart-context';
import { formatMoney } from '@/lib/format';
import { useState } from 'react';

interface QuoteLine {
  variantId: string;
  quantity: number;
}

interface QuoteResult {
  grandTotal: { amount: string; currency: string };
}

interface CheckoutResult {
  id: string;
  grandTotal: { amount: string; currency: string };
}

type Step = 'review' | 'placing' | 'success' | 'error' | 'unknown';

export default function CheckoutPage() {
  const router = useRouter();
  const { cart, clearCart, getIdempotencyKey } = useCart();
  const [step, setStep] = useState<Step>('review');
  const [quoteResult, setQuoteResult] = useState<QuoteResult | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [checkoutResult, setCheckoutResult] = useState<CheckoutResult | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const subtotal = cart.items.reduce((sum, item) => sum + parseInt(item.price) * item.quantity, 0);
  const priceChanged = quoteResult && quoteResult.grandTotal.amount !== subtotal.toString();
  const displayTotal = quoteResult ? quoteResult.grandTotal : { amount: subtotal.toString(), currency: 'VND' };

  if (cart.items.length === 0) {
    router.replace('/cart');
    return null;
  }

  const handleGetQuote = async () => {
    setQuoteError(null);
    setQuoteResult(null);
    const lines: QuoteLine[] = cart.items.map((i) => ({ variantId: i.variantId, quantity: i.quantity }));
    try {
      const res = await fetch('/api/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addressId: 'default', lines }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Quote failed');
      setQuoteResult(data);
    } catch (err) {
      setQuoteError(err instanceof Error ? err.message : 'Lỗi khi lấy báo giá');
    }
  };

  const handlePlaceOrder = async () => {
    setStep('placing');
    setCheckoutError(null);
    try {
      const idempotencyKey = await getIdempotencyKey();
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({
          addressId: 'default',
          lines: cart.items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
        }),
      });
      const data = await res.json();
      if (data.status === 'UNKNOWN' || data.result?.status === 'UNKNOWN') {
        setStep('unknown');
        return;
      }
      if (!res.ok) throw new Error(data.error || data.result?.error || 'Checkout failed');
      setCheckoutResult(data.result || data);
      clearCart();
      setStep('success');
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : 'Lỗi khi đặt hàng');
      setStep('error');
    }
  };

  return (
    <main style={{ padding: 24, maxWidth: 600, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>Thanh toán</h1>

      {step === 'review' && (
        <>
          <div style={{ marginBottom: 20 }}>
            {cart.items.map((item) => (
              <div key={item.variantId} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                <div>
                  <span style={{ fontWeight: 500 }}>{item.name}</span>
                  <span style={{ fontSize: 12, color: '#9ca3af', marginLeft: 8 }}>x{item.quantity}</span>
                  <div style={{ fontSize: 12, color: '#9ca3af' }}>{item.sku}</div>
                </div>
                <span style={{ fontWeight: 500 }}>
                  {formatMoney({ amount: (parseInt(item.price) * item.quantity).toString(), currency: 'VND' })}
                </span>
              </div>
            ))}
          </div>

          <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 16, marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span>Tạm tính:</span>
              <span>{formatMoney({ amount: subtotal.toString(), currency: 'VND' })}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 18 }}>
              <span>Tổng cộng:</span>
              <span>{formatMoney(displayTotal)}</span>
            </div>
          </div>

          {priceChanged && (
            <div style={{ background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 6, padding: 12, marginBottom: 16, color: '#92400e' }}>
              ⚠️ Giá đã thay đổi!
            </div>
          )}

          {quoteError && (
            <div style={{ background: '#fee2e2', border: '1px solid #ef4444', borderRadius: 6, padding: 12, marginBottom: 16, color: '#991b1b' }}>
              Lỗi: {quoteError}
            </div>
          )}

          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={handleGetQuote}
              style={{ flex: 1, padding: '10px 16px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer' }}
            >
              Xem giá mới
            </button>
            <button
              onClick={handlePlaceOrder}
              style={{ flex: 1, padding: '10px 16px', borderRadius: 6, border: 'none', background: '#111', color: '#fff', fontWeight: 600, cursor: 'pointer' }}
            >
              Đặt hàng
            </button>
          </div>

          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <a href="/cart" style={{ color: '#6b7280', fontSize: 14 }}>← Sửa giỏ</a>
          </div>
        </>
      )}

      {step === 'placing' && (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
          <p style={{ fontSize: 18 }}>Đang xử lý…</p>
        </div>
      )}

      {step === 'success' && checkoutResult && (
        <div style={{ textAlign: 'center', padding: 24 }}>
          <div style={{ background: '#d1fae5', border: '1px solid #059669', borderRadius: 8, padding: 24, marginBottom: 24 }}>
            <p style={{ fontSize: 20, fontWeight: 700, color: '#065f46', margin: '0 0 8px' }}>Đơn hàng đã được tạo!</p>
            <p style={{ color: '#065f46', margin: 0 }}>Mã đơn: {checkoutResult.id}</p>
            <p style={{ color: '#065f46', margin: '8px 0 0' }}>Thanh toán: {formatMoney(checkoutResult.grandTotal)}</p>
          </div>
          <a href="/" style={{ color: '#111', fontWeight: 500 }}>Tiếp tục mua sắm</a>
        </div>
      )}

      {step === 'error' && (
        <div style={{ textAlign: 'center', padding: 24 }}>
          <div style={{ background: '#fee2e2', border: '1px solid #ef4444', borderRadius: 8, padding: 24, marginBottom: 24 }}>
            <p style={{ fontSize: 18, fontWeight: 700, color: '#991b1b', margin: 0 }}>Lỗi thanh toán</p>
            <p style={{ color: '#991b1b', margin: '8px 0 0' }}>{checkoutError}</p>
          </div>
          <button
            onClick={() => setStep('review')}
            style={{ padding: '10px 24px', borderRadius: 6, border: 'none', background: '#111', color: '#fff', fontWeight: 500, cursor: 'pointer' }}
          >
            Thử lại
          </button>
        </div>
      )}

      {step === 'unknown' && (
        <div style={{ textAlign: 'center', padding: 24 }}>
          <div style={{ background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 8, padding: 24, marginBottom: 24 }}>
            <p style={{ fontSize: 18, fontWeight: 700, color: '#92400e', margin: 0 }}>Đang kiểm tra thanh toán…</p>
            <p style={{ color: '#92400e', margin: '8px 0 0' }}>Vui lòng đợi trong giây lát.</p>
          </div>
          <a href="/" style={{ color: '#6b7280', fontSize: 14 }}>Quay lại trang chủ</a>
        </div>
      )}
    </main>
  );
}
