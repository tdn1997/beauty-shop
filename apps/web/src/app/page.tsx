'use client';
import { useState } from 'react';
import { useCart } from '@/lib/cart-context';

const PRODUCTS = [
  {
    id: 'prod-1',
    name: 'Serum Dưỡng Ẩm',
    description: 'Giữ ẩm sâu, phục hồi da ban đêm',
    variants: [
      { variantId: 'SKU-SERUM-15', name: '15ml', price: '150000' },
      { variantId: 'SKU-SERUM-30', name: '30ml', price: '280000' },
    ],
  },
  {
    id: 'prod-2',
    name: 'Kem Chống Nắng SPF50+',
    description: 'Bảo vệ toàn diện khỏi tia UV',
    variants: [
      { variantId: 'SKU-SPF50-50G', name: '50g', price: '220000' },
      { variantId: 'SKU-SPF50-100G', name: '100g', price: '390000' },
    ],
  },
  {
    id: 'prod-3',
    name: 'Sữa Rửa Mặt CeraVe',
    description: 'Làm sạch nhẹ nhàng, không khô da',
    variants: [
      { variantId: 'SKU-FACEWASH-100', name: '100ml', price: '95000' },
    ],
  },
  {
    id: 'prod-4',
    name: 'Tinh Chất Vitamin C',
    description: 'Làm sáng da, giảm thâm nám',
    variants: [
      { variantId: 'SKU-VITC-10ML', name: '10ml', price: '180000' },
      { variantId: 'SKU-VITC-20ML', name: '20ml', price: '340000' },
    ],
  },
];

function fmtVND(amount: string): string {
  return parseInt(amount, 10).toLocaleString('vi-VN') + ' đ';
}

function pastelColor(name: string): string {
  const colors = [
    '#fce4ec', '#f3e5f5', '#e8eaf6', '#e0f7fa', '#e8f5e9',
    '#fff3e0', '#fce4ec', '#f3e5f5', '#e1f5fe', '#f1f8e9',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export default function ProductCatalog() {
  const { addItem } = useCart();
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({});

  const handleSelectVariant = (productId: string, variantId: string) => {
    setSelectedVariants((prev) => ({ ...prev, [productId]: variantId }));
  };

  const handleAddToCart = (product: typeof PRODUCTS[0]) => {
    const variantId = selectedVariants[product.id];
    if (!variantId) return;
    const variant = product.variants.find((v) => v.variantId === variantId);
    if (!variant) return;
    addItem({ variantId, sku: variantId, name: product.name, price: variant.price }, 1);
  };

  return (
    <main style={{ padding: '24px', maxWidth: 800, margin: '0 auto' }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 24 }}>Sản phẩm nổi bật</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
        {PRODUCTS.map((product) => (
          <div
            key={product.id}
            style={{
              border: '1px solid #e5e7eb',
              borderRadius: 12,
              padding: 16,
              background: '#fff',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            }}
          >
            <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
              <div
                style={{
                  width: 60,
                  height: 60,
                  borderRadius: 8,
                  background: pastelColor(product.name),
                  flexShrink: 0,
                }}
              />
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>{product.name}</h3>
                <p style={{ fontSize: 13, color: '#6b7280', margin: '4px 0 0' }}>{product.description}</p>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
              {product.variants.map((variant) => (
                <button
                  key={variant.variantId}
                  onClick={() => handleSelectVariant(product.id, variant.variantId)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 6,
                    border: selectedVariants[product.id] === variant.variantId ? '2px solid #111' : '1px solid #d1d5db',
                    background: selectedVariants[product.id] === variant.variantId ? '#f3f4f6' : '#fff',
                    cursor: 'pointer',
                    textAlign: 'left',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span style={{ fontSize: 13 }}>
                    <span style={{ fontWeight: 500 }}>{variant.name}</span>
                    <span style={{ color: '#9ca3af', marginLeft: 8, fontSize: 11 }}>{variant.variantId}</span>
                  </span>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{fmtVND(variant.price)}</span>
                </button>
              ))}
            </div>
            <button
              onClick={() => handleAddToCart(product)}
              disabled={!selectedVariants[product.id]}
              style={{
                width: '100%',
                padding: '10px 16px',
                borderRadius: 6,
                border: 'none',
                background: selectedVariants[product.id] ? '#111' : '#d1d5db',
                color: '#fff',
                fontWeight: 500,
                cursor: selectedVariants[product.id] ? 'pointer' : 'not-allowed',
              }}
            >
              Thêm vào giỏ
            </button>
          </div>
        ))}
      </div>
    </main>
  );
}
