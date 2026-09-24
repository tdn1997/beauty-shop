import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ProductCard from './product-card';
import type { StoreProduct } from '@/lib/storefront';

afterEach(cleanup);
const product: StoreProduct = {
  id: 'prod-vitc',
  name: 'Serum Vitamin C',
  description: 'Làm sáng da',
  category: 'serum',
  imagePath: '/products/prod-vitc.jpg',
  imageAlt: 'Chai serum Vitamin C',
  variants: [
    {
      variantId: 'SKU-VITC-10ML',
      sku: 'SKU-VITC-10ML',
      displayName: '15 ml',
      price: { amount: '179000', currency: 'VND' },
      available: 0,
    },
    {
      variantId: 'SKU-VITC-20ML',
      sku: 'SKU-VITC-20ML',
      displayName: '30 ml',
      price: { amount: '299000', currency: 'VND' },
      available: 4,
    },
  ],
};
const renderCard = (selectedVariantId = 'SKU-VITC-20ML') => {
  const onSelect = vi.fn(),
    onAdd = vi.fn();
  render(
    <ProductCard
      product={product}
      selectedVariantId={selectedVariantId}
      onSelect={onSelect}
      onAdd={onAdd}
    />,
  );
  return { onSelect, onAdd };
};

describe('ProductCard', () => {
  it('should show the product photo, category and the selected variant price', () => {
    // act
    renderCard();
    // assert
    expect(screen.getByRole('img', { name: 'Chai serum Vitamin C' })).toHaveAttribute(
      'src',
      '/products/prod-vitc.jpg',
    );
    expect(screen.getByText('Serum')).toBeInTheDocument();
    expect(screen.getByTestId('card-price')).toHaveTextContent('299.000 đ');
    expect(screen.getByText('Chỉ còn 4')).toBeInTheDocument();
  });
  it('should disable an out-of-stock variant', () => {
    // act
    renderCard();
    // assert
    expect(screen.getByRole('radio', { name: /15 ml/ })).toBeDisabled();
    expect(screen.getByRole('radio', { name: /30 ml/ })).toHaveAttribute('aria-checked', 'true');
  });
  it('should add the selected variant to the cart', () => {
    // arrange
    const { onAdd } = renderCard();
    // act
    fireEvent.click(screen.getByRole('button', { name: /Thêm vào giỏ/ }));
    // assert
    expect(onAdd).toHaveBeenCalledWith(product, product.variants[1]);
  });
  it('should not allow adding when no variant is in stock', () => {
    // arrange
    const { onAdd } = renderCard('');
    // act
    fireEvent.click(screen.getByRole('button', { name: /Hết hàng/ }));
    // assert
    expect(screen.getByRole('button', { name: /Hết hàng/ })).toBeDisabled();
    expect(onAdd).not.toHaveBeenCalled();
  });
  it('should fall back to the placeholder image when the photo fails to load', () => {
    // arrange
    renderCard();
    const img = screen.getByRole('img', { name: 'Chai serum Vitamin C' });
    // act
    fireEvent.error(img);
    // assert
    expect(img).toHaveAttribute('src', '/products/fallback.svg');
  });
});
