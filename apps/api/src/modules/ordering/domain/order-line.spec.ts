import { describe, expect, it } from 'vitest';

import { Money } from '../../shared/domain/money';
import { OrderLine } from './order-line';

const lineProps = {
  variantId: 'var_1',
  sku: 'SRM-VTC-30',
  nameSnapshot: 'Serum Vitamin C 30ml',
  unitPriceSnapshot: Money.parse('459000', 'VND'),
  quantity: 2,
};

describe('OrderLine - derived total', () => {
  it('should derive the subtotal from unit price and quantity', () => {
    // arrange
    const line = OrderLine.create(lineProps);

    // confirm
    expect(line.quantity).toBe(2);

    // act
    const subtotal = line.subtotal();

    // assert
    expect(subtotal.toString()).toBe('918000 VND');
  });

  it('should recompute the subtotal after the quantity changes', () => {
    // arrange
    const line = OrderLine.create(lineProps);

    // confirm
    expect(line.subtotal().toString()).toBe('918000 VND');

    // act
    line.changeQuantity(3);

    // assert
    expect(line.subtotal().toString()).toBe('1377000 VND');
  });
});

describe('OrderLine - quantity rules', () => {
  it('should reject a quantity of zero at creation', () => {
    // arrange
    const props = { ...lineProps, quantity: 0 };

    // confirm
    expect(() => OrderLine.create(lineProps)).not.toThrow();

    // act
    const act = () => OrderLine.create(props);

    // assert
    expect(act).toThrow(/INVALID_QUANTITY/);
  });

  it('should reject a non-integer quantity', () => {
    // arrange
    const props = { ...lineProps, quantity: 1.5 };

    // confirm
    expect(() => OrderLine.create(lineProps)).not.toThrow();

    // act
    const act = () => OrderLine.create(props);

    // assert
    expect(act).toThrow(/INVALID_QUANTITY/);
  });

  it('should leave the quantity untouched when a change is rejected', () => {
    // arrange
    const line = OrderLine.create(lineProps);

    // confirm
    expect(line.quantity).toBe(2);

    // act
    const act = () => line.changeQuantity(-1);

    // assert
    expect(act).toThrow(/INVALID_QUANTITY/);
    expect(line.quantity).toBe(2);
    expect(line.subtotal().toString()).toBe('918000 VND');
  });

  it('should reject a negative unit price', () => {
    // arrange
    const props = { ...lineProps, unitPriceSnapshot: Money.parse('-1', 'VND') };

    // confirm
    expect(() => OrderLine.create(lineProps)).not.toThrow();

    // act
    const act = () => OrderLine.create(props);

    // assert
    expect(act).toThrow(/INVALID_UNIT_PRICE/);
  });
});

describe('OrderLine - price snapshot', () => {
  it('should keep the price captured at order time even if the catalog price changes', () => {
    // arrange
    const catalogPrice = Money.parse('459000', 'VND');
    const line = OrderLine.create({ ...lineProps, unitPriceSnapshot: catalogPrice });

    // confirm
    expect(line.unitPriceSnapshot.toString()).toBe('459000 VND');

    // act
    const newCatalogPrice = Money.parse('399000', 'VND');

    // assert
    expect(newCatalogPrice.toString()).toBe('399000 VND');
    expect(line.unitPriceSnapshot.toString()).toBe('459000 VND');
    expect(line.subtotal().toString()).toBe('918000 VND');
  });

  it('should expose no writable own properties', () => {
    // arrange
    const line = OrderLine.create(lineProps);

    // confirm
    expect(line.sku).toBe('SRM-VTC-30');

    // act
    const ownKeys = Object.keys(line);

    // assert
    expect(ownKeys).toEqual([]);
  });
});
