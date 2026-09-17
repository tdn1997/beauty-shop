import { describe, expect, it } from 'vitest';

import { DomainError } from './domain-error';
import { Money } from './money';

describe('Money - construction', () => {
  it('should parse a decimal string into the currency minor units', () => {
    // arrange
    const raw = '129.50';

    // confirm
    expect(typeof raw).toBe('string');

    // act
    const money = Money.parse(raw, 'USD');

    // assert
    expect(money.toString()).toBe('129.50 USD');
  });

  it('should keep VND as a zero-decimal currency', () => {
    // arrange
    const raw = '129000';

    // confirm
    expect(raw).not.toContain('.');

    // act
    const money = Money.parse(raw, 'VND');

    // assert
    expect(money.toString()).toBe('129000 VND');
  });

  it('should pad a short fraction to the full minor units', () => {
    // arrange
    const raw = '7.5';

    // confirm
    expect(raw.split('.')[1]).toHaveLength(1);

    // act
    const money = Money.parse(raw, 'USD');

    // assert
    expect(money.toString()).toBe('7.50 USD');
  });

  it('should reject a fraction longer than the currency allows', () => {
    // arrange
    const raw = '12.345';

    // confirm
    expect(() => Money.parse('12.34', 'USD')).not.toThrow();

    // act
    const act = () => Money.parse(raw, 'USD');

    // assert
    expect(act).toThrow(DomainError);
    expect(act).toThrow(/INVALID_MONEY/);
  });

  it('should reject a fraction on a zero-decimal currency', () => {
    // arrange
    const raw = '129000.5';

    // confirm
    expect(() => Money.parse('129000', 'VND')).not.toThrow();

    // act
    const act = () => Money.parse(raw, 'VND');

    // assert
    expect(act).toThrow(/INVALID_MONEY/);
  });

  it('should reject a non-numeric string', () => {
    // arrange
    const raw = '12a.00';

    // confirm
    expect(() => Money.parse('12.00', 'USD')).not.toThrow();

    // act
    const act = () => Money.parse(raw, 'USD');

    // assert
    expect(act).toThrow(/INVALID_MONEY/);
  });

  it('should parse a negative amount', () => {
    // arrange
    const raw = '-0.05';

    // confirm
    expect(raw.startsWith('-')).toBe(true);

    // act
    const money = Money.parse(raw, 'USD');

    // assert
    expect(money.toString()).toBe('-0.05 USD');
  });

  it('should expose a zero value per currency', () => {
    // arrange
    const currency = 'VND' as const;

    // confirm
    expect(Money.zero).toBeInstanceOf(Function);

    // act
    const money = Money.zero(currency);

    // assert
    expect(money.toString()).toBe('0 VND');
  });
});

describe('Money - arithmetic', () => {
  it('should add two amounts of the same currency', () => {
    // arrange
    const a = Money.parse('10.25', 'USD');
    const b = Money.parse('0.75', 'USD');

    // confirm
    expect(a.toString()).toBe('10.25 USD');

    // act
    const sum = a.add(b);

    // assert
    expect(sum.toString()).toBe('11.00 USD');
  });

  it('should leave both operands unchanged when adding', () => {
    // arrange
    const a = Money.parse('10.25', 'USD');
    const b = Money.parse('0.75', 'USD');

    // confirm
    expect(a.toString()).toBe('10.25 USD');

    // act
    a.add(b);

    // assert
    expect(a.toString()).toBe('10.25 USD');
    expect(b.toString()).toBe('0.75 USD');
  });

  it('should refuse to add a different currency', () => {
    // arrange
    const vnd = Money.parse('129000', 'VND');
    const usd = Money.parse('5.00', 'USD');

    // confirm
    expect(vnd.currency).not.toBe(usd.currency);

    // act
    const act = () => vnd.add(usd);

    // assert
    expect(act).toThrow(DomainError);
    expect(act).toThrow(/CURRENCY_MISMATCH/);
  });

  it('should multiply by an integer quantity', () => {
    // arrange
    const unitPrice = Money.parse('19.99', 'USD');

    // confirm
    expect(unitPrice.toString()).toBe('19.99 USD');

    // act
    const total = unitPrice.times(3);

    // assert
    expect(total.toString()).toBe('59.97 USD');
  });

  it('should refuse a non-integer multiplier', () => {
    // arrange
    const unitPrice = Money.parse('19.99', 'USD');

    // confirm
    expect(() => unitPrice.times(2)).not.toThrow();

    // act
    const act = () => unitPrice.times(1.5);

    // assert
    expect(act).toThrow(/INVALID_MULTIPLIER/);
  });

  it('should compare equality by amount and currency', () => {
    // arrange
    const a = Money.parse('19.99', 'USD');
    const b = Money.parse('19.99', 'USD');
    const c = Money.parse('19.98', 'USD');

    // confirm
    expect(a).not.toBe(b);

    // act
    const same = a.equals(b);
    const different = a.equals(c);

    // assert
    expect(same).toBe(true);
    expect(different).toBe(false);
  });

  it('should report whether the amount is negative', () => {
    // arrange
    const positive = Money.parse('0.01', 'USD');
    const negative = Money.parse('-0.01', 'USD');

    // confirm
    expect(positive.equals(negative)).toBe(false);

    // act
    const results = [positive.isNegative(), negative.isNegative()];

    // assert
    expect(results).toEqual([false, true]);
  });
});

describe('Money - encapsulation', () => {
  it('should not expose a writable amount field', () => {
    // arrange
    const money = Money.parse('19.99', 'USD');

    // confirm
    expect(money.toString()).toBe('19.99 USD');

    // act
    const ownKeys = Object.keys(money);

    // assert
    expect(ownKeys).toEqual([]);
  });

  it('should serialise to a transport shape without leaking internals', () => {
    // arrange
    const money = Money.parse('19.99', 'USD');

    // confirm
    expect(Object.keys(money)).toEqual([]);

    // act
    const dto = money.toJSON();

    // assert
    expect(dto).toEqual({ amount: '19.99', currency: 'USD' });
  });
});
