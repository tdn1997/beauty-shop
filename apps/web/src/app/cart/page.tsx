'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCart } from '@/lib/cart-context';
import { formatMoney } from '@/lib/format';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { multiplyMinorUnits, sumMinorUnits } from '@/lib/money';
import QuantityStepper from '@/components/quantity-stepper';
export default function CartPage() {
  const router = useRouter();
  const { cart, updateQuantity, removeItem } = useCart();
  if (cart.items.length === 0)
    return (
      <main id="main" className="container container--narrow">
        <EmptyState
          icon="🧺"
          title="Giỏ hàng trống"
          description="Chưa có sản phẩm nào trong giỏ hàng."
          action={
            <Link className="btn btn--primary" href="/">
              Tiếp tục mua sắm
            </Link>
          }
        />
      </main>
    );
  const subtotal = sumMinorUnits(cart.items);
  return (
    <main id="main" className="container">
      <h1 className="page-title" style={{ marginBottom: '1.5rem' }}>
        Giỏ hàng
      </h1>
      <div className="cart-layout">
        <div className="cart-lines">
          {cart.items.map((item) => (
            <article className="card cart-line" key={item.variantId}>
              <div className="cart-line__thumb" aria-hidden="true" />
              <div>
                <h2 className="section-title">{item.name}</h2>
                <div className="mono text-muted truncate" title={item.sku}>
                  SKU: {item.sku}
                </div>
                <div className="text-sm">
                  {formatMoney({ amount: item.price, currency: 'VND' })} / cái
                </div>
              </div>
              <QuantityStepper
                variantId={item.variantId}
                name={item.name}
                quantity={item.quantity}
                updateQuantity={updateQuantity}
              />
              <div className="price tabular">
                {formatMoney({
                  amount: multiplyMinorUnits(item.price, item.quantity),
                  currency: 'VND',
                })}
              </div>
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Xoá ${item.name} khỏi giỏ`}
                onClick={() => removeItem(item.variantId)}
              >
                Xoá
              </Button>
            </article>
          ))}
        </div>
        <aside className="card cart-summary">
          <h2 className="section-title">Tóm tắt đơn hàng</h2>
          <div className="summary-row summary-row--total">
            <span>Tạm tính</span>
            <span className="price price--lg">
              {formatMoney({ amount: subtotal, currency: 'VND' })}
            </span>
          </div>
          <Button size="lg" block onClick={() => router.push('/checkout')}>
            Tiếp tục thanh toán
          </Button>
          <Link className="btn btn--ghost btn--block" href="/">
            ← Tiếp tục mua sắm
          </Link>
        </aside>
      </div>
    </main>
  );
}
