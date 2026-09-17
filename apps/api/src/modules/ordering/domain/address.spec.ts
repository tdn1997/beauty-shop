import { describe, expect, it } from 'vitest';

import { Address } from './address';

const validProps = {
  recipientName: 'Nguyễn Văn A',
  phone: '0901234567',
  line1: '12 Lý Thường Kiệt',
  ward: 'Phường 7',
  district: 'Quận 10',
  province: 'TP. Hồ Chí Minh',
};

describe('Address - validation', () => {
  it('should build an address when every required field is present', () => {
    // arrange
    const props = { ...validProps };

    // confirm
    expect(props.recipientName).not.toBe('');

    // act
    const address = Address.create(props);

    // assert
    expect(address.toJSON()).toEqual({ ...validProps, line2: null });
  });

  it('should reject a blank recipient name', () => {
    // arrange
    const props = { ...validProps, recipientName: '   ' };

    // confirm
    expect(() => Address.create(validProps)).not.toThrow();

    // act
    const act = () => Address.create(props);

    // assert
    expect(act).toThrow(/INVALID_ADDRESS/);
  });

  it('should reject a blank province', () => {
    // arrange
    const props = { ...validProps, province: '' };

    // confirm
    expect(() => Address.create(validProps)).not.toThrow();

    // act
    const act = () => Address.create(props);

    // assert
    expect(act).toThrow(/INVALID_ADDRESS/);
  });

  it('should reject a phone number that is not a Vietnamese mobile number', () => {
    // arrange
    const props = { ...validProps, phone: '12345' };

    // confirm
    expect(() => Address.create(validProps)).not.toThrow();

    // act
    const act = () => Address.create(props);

    // assert
    expect(act).toThrow(/INVALID_ADDRESS/);
  });

  it('should trim surrounding whitespace on every field', () => {
    // arrange
    const props = { ...validProps, line1: '  12 Lý Thường Kiệt  ' };

    // confirm
    expect(props.line1).not.toBe('12 Lý Thường Kiệt');

    // act
    const address = Address.create(props);

    // assert
    expect(address.toJSON().line1).toBe('12 Lý Thường Kiệt');
  });

  it('should treat an omitted line2 as null rather than undefined', () => {
    // arrange
    const props = { ...validProps };

    // confirm
    expect('line2' in props).toBe(false);

    // act
    const address = Address.create(props);

    // assert
    expect(address.toJSON().line2).toBeNull();
  });
});

describe('Address - immutability', () => {
  it('should expose no writable own properties', () => {
    // arrange
    const address = Address.create(validProps);

    // confirm
    expect(address.toJSON().ward).toBe('Phường 7');

    // act
    const ownKeys = Object.keys(address);

    // assert
    expect(ownKeys).toEqual([]);
  });

  it('should not be affected by mutating the props object afterwards', () => {
    // arrange
    const props = { ...validProps };
    const address = Address.create(props);

    // confirm
    expect(address.toJSON().district).toBe('Quận 10');

    // act
    props.district = 'Quận 1';

    // assert
    expect(address.toJSON().district).toBe('Quận 10');
  });

  it('should compare by value, not by reference', () => {
    // arrange
    const a = Address.create(validProps);
    const b = Address.create({ ...validProps });
    const c = Address.create({ ...validProps, ward: 'Phường 8' });

    // confirm
    expect(a).not.toBe(b);

    // act
    const results = [a.equals(b), a.equals(c)];

    // assert
    expect(results).toEqual([true, false]);
  });
});
