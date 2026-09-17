import { describe, expect, it } from 'vitest';

import { Money } from '../../shared/domain/money';
import { Product, ProductStatus } from './product';
import { ProductVariant } from './product-variant';

describe('Product - identity vs description', () => {
  it('should keep the identifier fixed for the lifetime of the product', () => {
    // arrange
    const product = Product.create({ id: 'prd_1', name: 'Serum Vitamin C' });

    // confirm
    expect(product.id).toBe('prd_1');

    // act
    product.rename('Serum Vitamin C 10%');

    // assert
    expect(product.id).toBe('prd_1');
    expect(product.name).toBe('Serum Vitamin C 10%');
  });

  it('should start as a draft so an unfinished product cannot be sold', () => {
    // arrange
    const props = { id: 'prd_1', name: 'Serum Vitamin C' };

    // confirm
    expect(props.id).toBe('prd_1');

    // act
    const product = Product.create(props);

    // assert
    expect(product.status).toBe(ProductStatus.Draft);
  });

  it('should become sellable only after being published', () => {
    // arrange
    const product = Product.create({ id: 'prd_1', name: 'Serum Vitamin C' });

    // confirm
    expect(product.isSellable()).toBe(false);

    // act
    product.publish();

    // assert
    expect(product.status).toBe(ProductStatus.Active);
    expect(product.isSellable()).toBe(true);
  });

  it('should stop being sellable once archived', () => {
    // arrange
    const product = Product.create({ id: 'prd_1', name: 'Serum Vitamin C' });
    product.publish();

    // confirm
    expect(product.isSellable()).toBe(true);

    // act
    product.archive();

    // assert
    expect(product.status).toBe(ProductStatus.Archived);
    expect(product.isSellable()).toBe(false);
  });

  it('should reject a blank name', () => {
    // arrange
    const props = { id: 'prd_1', name: '  ' };

    // confirm
    expect(() => Product.create({ id: 'prd_1', name: 'ok' })).not.toThrow();

    // act
    const act = () => Product.create(props);

    // assert
    expect(act).toThrow(/INVALID_PRODUCT/);
  });

  it('should expose no writable own properties', () => {
    // arrange
    const product = Product.create({ id: 'prd_1', name: 'Serum Vitamin C' });

    // confirm
    expect(product.name).toBe('Serum Vitamin C');

    // act
    const ownKeys = Object.keys(product);

    // assert
    expect(ownKeys).toEqual([]);
  });
});

describe('ProductVariant', () => {
  const baseProps = {
    id: 'var_1',
    productId: 'prd_1',
    sku: 'SRM-VTC-30',
    name: '30ml',
    listPrice: Money.parse('459000', 'VND'),
  };

  it('should normalise the sku to upper case', () => {
    // arrange
    const props = { ...baseProps, sku: 'srm-vtc-30' };

    // confirm
    expect(props.sku).toBe('srm-vtc-30');

    // act
    const variant = ProductVariant.create(props);

    // assert
    expect(variant.sku).toBe('SRM-VTC-30');
  });

  it('should reject a blank sku', () => {
    // arrange
    const props = { ...baseProps, sku: '   ' };

    // confirm
    expect(() => ProductVariant.create(baseProps)).not.toThrow();

    // act
    const act = () => ProductVariant.create(props);

    // assert
    expect(act).toThrow(/INVALID_VARIANT/);
  });

  it('should reject a negative list price', () => {
    // arrange
    const props = { ...baseProps, listPrice: Money.parse('-1', 'VND') };

    // confirm
    expect(() => ProductVariant.create(baseProps)).not.toThrow();

    // act
    const act = () => ProductVariant.create(props);

    // assert
    expect(act).toThrow(/INVALID_VARIANT/);
  });

  it('should change the list price through an intention-revealing method', () => {
    // arrange
    const variant = ProductVariant.create(baseProps);

    // confirm
    expect(variant.listPrice.toString()).toBe('459000 VND');

    // act
    variant.changeListPrice(Money.parse('399000', 'VND'));

    // assert
    expect(variant.listPrice.toString()).toBe('399000 VND');
  });

  it('should refuse a price in a different currency', () => {
    // arrange
    const variant = ProductVariant.create(baseProps);

    // confirm
    expect(variant.listPrice.currency).toBe('VND');

    // act
    const act = () => variant.changeListPrice(Money.parse('19.99', 'USD'));

    // assert
    expect(act).toThrow(/CURRENCY_MISMATCH/);
  });

  it('should refuse a negative price change', () => {
    // arrange
    const variant = ProductVariant.create(baseProps);

    // confirm
    expect(variant.listPrice.isNegative()).toBe(false);

    // act
    const act = () => variant.changeListPrice(Money.parse('-1', 'VND'));

    // assert
    expect(act).toThrow(/INVALID_VARIANT/);
  });

  it('should stop being sellable once discontinued', () => {
    // arrange
    const variant = ProductVariant.create(baseProps);

    // confirm
    expect(variant.isSellable()).toBe(true);

    // act
    variant.discontinue();

    // assert
    expect(variant.isSellable()).toBe(false);
  });
});
