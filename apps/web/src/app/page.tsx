'use client';
import { useEffect, useMemo, useState } from 'react';
import { useCart } from '@/lib/cart-context';
import { formatMoney } from '@/lib/format';
import ProductImage from '@/components/product-image';
type Variant = {
  variantId: string;
  sku: string;
  displayName: string;
  price: { amount: string; currency: string };
  available: number;
};
type Product = {
  id: string;
  name: string;
  description: string;
  category: string;
  imagePath: string | null;
  imageAlt: string | null;
  variants: Variant[];
};
export default function Store() {
  const { addItem } = useCart();
  const [products, setProducts] = useState<Product[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [query, setQuery] = useState(''),
    [category, setCategory] = useState('all'),
    [selected, setSelected] = useState<Record<string, string>>({});
  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const r = await fetch('/api/products', { cache: 'no-store' });
      if (!r.ok) throw new Error();
      const data: Product[] = await r.json();
      setProducts(data);
      setSelected(
        Object.fromEntries(
          data.map((p) => [p.id, p.variants.find((v) => v.available > 0)?.variantId ?? '']),
        ),
      );
    } catch {
      setError('Không thể tải danh mục.');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);
  const categories = ['all', ...new Set(products.map((p) => p.category))];
  const shown = useMemo(
    () =>
      products.filter(
        (p) =>
          (category === 'all' || p.category === category) &&
          `${p.name} ${p.description}`.toLowerCase().includes(query.toLowerCase()),
      ),
    [products, category, query],
  );
  return (
    <main id="main">
      <section className="container product-hero">
        <div>
          <h1 className="page-title">Vẻ đẹp dịu dàng, mỗi ngày</h1>
          <p className="text-muted">Danh mục chăm sóc cá nhân được chọn lọc.</p>
          <a className="btn btn--primary" href="#catalog">
            Khám phá sản phẩm
          </a>
        </div>
      </section>
      <section id="catalog" className="container stack gap-4">
        <div className="checkout-actions">
          <label className="field">
            <span className="label">Tìm kiếm</span>
            <input
              className="input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tên sản phẩm"
            />
          </label>
          <label className="field">
            <span className="label">Danh mục</span>
            <select
              className="input"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c === 'all' ? 'Tất cả' : c}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p>
          {shown.length} sản phẩm{' '}
          {query && (
            <button className="btn btn--ghost btn--sm" onClick={() => setQuery('')}>
              Xóa tìm kiếm
            </button>
          )}
        </p>
        {loading && <p role="status">Đang tải…</p>}
        {error && (
          <div className="alert alert--danger" role="alert">
            {error} <button onClick={load}>Thử lại</button>
          </div>
        )}
        {!loading && !error && shown.length === 0 && (
          <p className="empty-state">Không tìm thấy sản phẩm.</p>
        )}
        <div className="product-grid">
          {shown.map((p) => {
            const choice = p.variants.find((v) => v.variantId === selected[p.id]);
            return (
              <article className="card product-card" key={p.id}>
                {p.imagePath && (
                  <img className="product-card__thumb" src={p.imagePath} alt={p.imageAlt ?? ''} />
                )}
                <div className="card__body stack gap-3">
                  <h2 className="section-title">{p.name}</h2>
                  <p>{p.description}</p>
                  <div role="radiogroup" className="variant-list">
                    {p.variants.map((v) => (
                      <button
                        className="variant"
                        role="radio"
                        aria-checked={v === choice}
                        disabled={v.available <= 0}
                        onClick={() => setSelected((x) => ({ ...x, [p.id]: v.variantId }))}
                        key={v.variantId}
                      >
                        <span>
                          {v.displayName} · {v.available > 0 ? `Còn ${v.available}` : 'Hết hàng'}
                        </span>
                        <strong>{formatMoney(v.price)}</strong>
                      </button>
                    ))}
                  </div>
                  <button
                    className="btn btn--primary"
                    disabled={!choice || choice.available <= 0}
                    onClick={() =>
                      choice &&
                      addItem({
                        variantId: choice.variantId,
                        sku: choice.sku,
                        name: `${p.name} ${choice.displayName}`,
                        price: choice.price.amount,
                      })
                    }
                  >
                    Thêm vào giỏ
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
