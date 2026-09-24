'use client';
import { useEffect, useMemo, useState } from 'react';
import { useCart } from '@/lib/cart-context';
import ProductCard from '@/components/product-card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  categoryLabel,
  filterProducts,
  orderVariantsByPrice,
  sortProducts,
  type SortKey,
  type StoreProduct,
  type StoreVariant,
} from '@/lib/storefront';

const HERO_IMAGES = [
  { src: '/products/prod-spf50.jpg', alt: 'Sữa chống nắng La Roche-Posay Anthelios' },
  { src: '/products/prod-facewash.jpg', alt: 'Sữa rửa mặt CeraVe' },
  { src: '/products/prod-retinol.jpg', alt: 'Serum The Ordinary Retinol' },
];
const PERKS = [
  { icon: '✓', title: 'Hàng chính hãng', text: 'Thương hiệu dược mỹ phẩm' },
  { icon: '▣', title: 'Tồn kho thời gian thực', text: 'Biết ngay còn hay hết' },
  { icon: '🔒', title: 'Thanh toán an toàn', text: 'Không trừ tiền hai lần' },
];

export default function Store() {
  const { addItem } = useCart();
  const [products, setProducts] = useState<StoreProduct[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [query, setQuery] = useState(''),
    [category, setCategory] = useState('all'),
    [sort, setSort] = useState<SortKey>('featured'),
    [selected, setSelected] = useState<Record<string, string>>({});
  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const r = await fetch('/api/products', { cache: 'no-store' });
      if (!r.ok) throw new Error();
      const data = orderVariantsByPrice((await r.json()) as StoreProduct[]);
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
  const categories = useMemo(
    () => ['all', ...new Set(products.map((p) => p.category))],
    [products],
  );
  const shown = useMemo(
    () => sortProducts(filterProducts(products, { query, category }), sort),
    [products, category, query, sort],
  );
  const add = (p: StoreProduct, v: StoreVariant) =>
    addItem({
      variantId: v.variantId,
      sku: v.sku,
      name: `${p.name} ${v.displayName}`,
      price: v.price.amount,
      imagePath: p.imagePath,
    });
  const resetFilters = () => {
    setQuery('');
    setCategory('all');
  };

  return (
    <main id="main">
      <section className="hero">
        <div className="hero__inner">
          <div className="hero__copy">
            <span className="eyebrow">Dược mỹ phẩm chính hãng</span>
            <h1 className="hero__title">Vẻ đẹp dịu dàng, mỗi ngày</h1>
            <p className="hero__lead">
              CeraVe, La Roche-Posay, The Ordinary, Garnier… được tuyển chọn cho làn da nhiệt đới —
              từ làm sạch, đặc trị đến chống nắng.
            </p>
            <div className="hero__actions">
              <a className="btn btn--primary btn--lg" href="#catalog">
                Khám phá sản phẩm
              </a>
              <button
                type="button"
                className="btn btn--secondary btn--lg"
                onClick={() => {
                  setCategory('sunscreen');
                  document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                Chống nắng mùa hè
              </button>
            </div>
          </div>
          <div className="hero__art" aria-hidden="true">
            {HERO_IMAGES.map((img, i) => (
              <img key={img.src} className={`hero__img hero__img--${i + 1}`} src={img.src} alt="" />
            ))}
          </div>
        </div>
      </section>

      <ul className="perks container" aria-label="Cam kết của BeautyShop">
        {PERKS.map((p) => (
          <li className="perk" key={p.title}>
            <span className="perk__icon" aria-hidden="true">
              {p.icon}
            </span>
            <span>
              <strong>{p.title}</strong>
              <span className="text-muted text-sm"> · {p.text}</span>
            </span>
          </li>
        ))}
      </ul>

      <section id="catalog" className="container catalog" aria-labelledby="catalog-title">
        <div className="catalog__head">
          <h2 id="catalog-title" className="page-title">
            Sản phẩm
          </h2>
          <div className="catalog__tools">
            <label className="search">
              <span className="sr-only">Tìm kiếm sản phẩm</span>
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
                <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" />
              </svg>
              <input
                className="search__input"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Tìm sữa rửa mặt, serum…"
              />
            </label>
            <label className="field field--inline">
              <span className="sr-only">Sắp xếp</span>
              <select
                className="input"
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
              >
                <option value="featured">Nổi bật</option>
                <option value="price-asc">Giá thấp → cao</option>
                <option value="price-desc">Giá cao → thấp</option>
              </select>
            </label>
          </div>
        </div>

        <div className="category-bar" role="group" aria-label="Lọc theo danh mục">
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              className="pill"
              aria-pressed={category === c}
              onClick={() => setCategory(c)}
            >
              {c === 'all' ? 'Tất cả' : categoryLabel(c)}
            </button>
          ))}
        </div>

        {!loading && !error && (
          <p className="text-muted text-sm" role="status">
            {shown.length} sản phẩm
            {(query || category !== 'all') && (
              <>
                {' · '}
                <button type="button" className="link-button" onClick={resetFilters}>
                  Xoá bộ lọc
                </button>
              </>
            )}
          </p>
        )}
        {error && (
          <div className="alert alert--danger" role="alert">
            {error}{' '}
            <button type="button" className="link-button" onClick={load}>
              Thử lại
            </button>
          </div>
        )}
        {!loading && !error && shown.length === 0 && (
          <div className="empty-state">
            <div className="empty-state__icon" aria-hidden="true">
              🔍
            </div>
            <p className="section-title">Không tìm thấy sản phẩm phù hợp</p>
            <button type="button" className="btn btn--secondary" onClick={resetFilters}>
              Xoá bộ lọc
            </button>
          </div>
        )}
        <div className="product-grid" aria-busy={loading || undefined}>
          {loading
            ? Array.from({ length: 8 }, (_, i) => (
                <div className="product-card" key={i} aria-hidden="true">
                  <Skeleton className="skeleton--thumb" />
                  <div className="product-card__body stack gap-2">
                    <Skeleton />
                    <Skeleton />
                  </div>
                </div>
              ))
            : shown.map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  selectedVariantId={selected[p.id] ?? ''}
                  onSelect={(productId, variantId) =>
                    setSelected((x) => ({ ...x, [productId]: variantId }))
                  }
                  onAdd={add}
                />
              ))}
        </div>
      </section>
    </main>
  );
}
