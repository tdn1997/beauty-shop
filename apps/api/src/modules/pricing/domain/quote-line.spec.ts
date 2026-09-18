import { describe, expect, it } from 'vitest';

import { DomainError } from '../../shared/domain/domain-error';
import { Money } from '../../shared/domain/money';
import { QuoteLine } from './quote-line';

const serum = {
  variantId: 'var_1',
  sku: 'SRM-VTC-30',
  nameSnapshot: 'Serum Vitamin C 30ml',
  unitPrice: Money.parse('459000', 'VND'),
  quantity: 2,
};

describe('QuoteLine - construction', () => {
  it('should expose the snapshot it was quoted with', () => {
    // arrange
    const props = { ...serum };

    // confirm
    expect(props.quantity).toBe(2);

    // act
    const line = QuoteLine.create(props);

    // assert
    expect(line.variantId).toBe('var_1');
    expect(line.sku).toBe('SRM-VTC-30');
    expect(line.nameSnapshot).toBe('Serum Vitamin C 30ml');
    expect(line.unitPrice.toString()).toBe('459000 VND');
    expect(line.quantity).toBe(2);
  });

  it('should reject a blank variantId', () => {
    // arrange
    const props = { ...serum, variantId: '  ' };

    // confirm
    expect(() => QuoteLine.create(serum)).not.toThrow();

    // act
    const before = { ...props, unitPrice: props.unitPrice.toString() };
    const act = () => QuoteLine.create(props);

    // assert
    expect(act).toThrow(DomainError);
    expect(act).toThrow(/INVALID_QUOTE_LINE/);
    expect({ ...props, unitPrice: props.unitPrice.toString() }).toEqual(before);
  });

  it('should reject a blank sku', () => {
    // arrange
    const props = { ...serum, sku: '' };

    // confirm
    expect(() => QuoteLine.create(serum)).not.toThrow();

    // act
    const before = { ...props, unitPrice: props.unitPrice.toString() };
    const act = () => QuoteLine.create(props);

    // assert
    expect(act).toThrow(/INVALID_QUOTE_LINE/);
    expect({ ...props, unitPrice: props.unitPrice.toString() }).toEqual(before);
  });

  it('should reject a blank name snapshot', () => {
    // arrange
    const props = { ...serum, nameSnapshot: '' };

    // confirm
    expect(() => QuoteLine.create(serum)).not.toThrow();

    // act
    const before = { ...props, unitPrice: props.unitPrice.toString() };
    const act = () => QuoteLine.create(props);

    // assert
    expect(act).toThrow(/INVALID_QUOTE_LINE/);
    expect({ ...props, unitPrice: props.unitPrice.toString() }).toEqual(before);
  });

  it('should reject a quantity that is not a positive integer', () => {
    // arrange
    const props = { ...serum, quantity: 0 };

    // confirm
    expect(() => QuoteLine.create(serum)).not.toThrow();

    // act
    const before = { ...props, unitPrice: props.unitPrice.toString() };
    const act = () => QuoteLine.create(props);

    // assert
    expect(act).toThrow(/INVALID_QUANTITY/);
    expect({ ...props, unitPrice: props.unitPrice.toString() }).toEqual(before);
  });

  it('should reject a negative unit price', () => {
    // arrange
    const props = { ...serum, unitPrice: Money.parse('-1000', 'VND') };

    // confirm
    expect(props.unitPrice.isNegative()).toBe(true);

    // act
    const before = { ...props, unitPrice: props.unitPrice.toString() };
    const act = () => QuoteLine.create(props);

    // assert
    expect(act).toThrow(/INVALID_UNIT_PRICE/);
    expect({ ...props, unitPrice: props.unitPrice.toString() }).toEqual(before);
  });
});

describe('QuoteLine - derived values', () => {
  it('should multiply its own price by its own quantity', () => {
    // arrange
    const line = QuoteLine.create(serum);

    // confirm
    expect(line.quantity).toBe(2);

    // act
    const subtotal = line.subtotal();

    // assert
    expect(subtotal.toString()).toBe('918000 VND');
  });

  it('should leave the line unchanged after computing the subtotal', () => {
    // arrange
    const line = QuoteLine.create(serum);
    const before = { unitPrice: line.unitPrice.toString(), quantity: line.quantity };

    // confirm
    expect(before.quantity).toBe(2);

    // act
    line.subtotal();

    // assert
    expect({ unitPrice: line.unitPrice.toString(), quantity: line.quantity }).toEqual(before);
  });

  it('should not expose any writable field', () => {
    // arrange
    const line = QuoteLine.create(serum);

    // confirm
    expect(line.sku).toBe('SRM-VTC-30');

    // act
    const ownKeys = Object.keys(line);

    // assert
    expect(ownKeys).toEqual([]);
  });
});
