'use client';
import React, { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { formatMoney } from '@/lib/format';
import { categoryLabel, stockLevel, type StoreProduct, type StoreVariant } from '@/lib/storefront';

const FALLBACK_IMAGE = '/products/fallback.svg';
const ADDED_FEEDBACK_MS = 1600;

function StockNote({ variant }: { variant: StoreVariant }) {
  const level = stockLevel(variant);
  if (level === 'in') return <span className="stock stock--in">Còn hàng</span>;
  if (level === 'low') return <span className="stock stock--low">Chỉ còn {variant.available}</span>;
  return <span className="stock stock--out">Hết hàng</span>;
}

export default function ProductCard({
  product,
  selectedVariantId,
  onSelect,
  onAdd,
}: {
  product: StoreProduct;
  selectedVariantId: string;
  onSelect: (productId: string, variantId: string) => void;
  onAdd: (product: StoreProduct, variant: StoreVariant) => void;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const [justAdded, setJustAdded] = useState(false);
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const choice = product.variants.find((v) => v.variantId === selectedVariantId);
  const displayed = choice ?? product.variants[0];
  const canAdd = !!choice && choice.available > 0;

  useEffect(() => {
    if (!justAdded) return;
    const t = setTimeout(() => setJustAdded(false), ADDED_FEEDBACK_MS);
    return () => clearTimeout(t);
  }, [justAdded]);

  // Radiogroup theo WAI-ARIA: phím mũi tên chuyển giữa các biến thể còn hàng.
  const onKey = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft'].includes(e.key)) return;
    e.preventDefault();
    const delta = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : -1;
    const n = product.variants.length;
    for (let step = 1; step <= n; step++) {
      const next = (index + delta * step + n * n) % n;
      const v = product.variants[next]!;
      if (v.available > 0) {
        onSelect(product.id, v.variantId);
        refs.current[next]?.focus();
        return;
      }
    }
  };

  return (
    <article className="product-card">
      <div className="product-card__media">
        <img
          className="product-card__img"
          src={!imageFailed && product.imagePath ? product.imagePath : FALLBACK_IMAGE}
          alt={product.imageAlt ?? product.name}
          width={800}
          height={800}
          loading="lazy"
          decoding="async"
          onError={() => setImageFailed(true)}
        />
        <span className="product-card__tag">{categoryLabel(product.category)}</span>
      </div>
      <div className="product-card__body">
        <h2 className="product-card__name">{product.name}</h2>
        <p className="product-card__desc">{product.description}</p>
        <div className="chip-row" role="radiogroup" aria-label={`Chọn dung tích ${product.name}`}>
          {product.variants.map((v, i) => {
            const checked = v.variantId === selectedVariantId;
            return (
              <button
                ref={(el) => {
                  refs.current[i] = el;
                }}
                key={v.variantId}
                type="button"
                role="radio"
                className="chip"
                aria-checked={checked}
                disabled={v.available <= 0}
                tabIndex={checked || (!choice && i === 0) ? 0 : -1}
                onClick={() => onSelect(product.id, v.variantId)}
                onKeyDown={(e) => onKey(e, i)}
              >
                {v.displayName}
              </button>
            );
          })}
        </div>
      </div>
      <div className="product-card__footer">
        <div className="stack">
          <span className="product-card__price" data-testid="card-price">
            {displayed && formatMoney(displayed.price)}
          </span>
          {displayed && <StockNote variant={displayed} />}
        </div>
        <button
          type="button"
          className="btn btn--primary product-card__add"
          disabled={!canAdd}
          aria-live="polite"
          onClick={() => {
            if (!choice) return;
            onAdd(product, choice);
            setJustAdded(true);
          }}
        >
          {!canAdd ? 'Hết hàng' : justAdded ? 'Đã thêm ✓' : 'Thêm vào giỏ'}
        </button>
      </div>
    </article>
  );
}
