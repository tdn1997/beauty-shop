import { describe, expect, it } from 'vitest';

import { FixedClock } from '../../shared/domain/clock';
import { InventoryLot } from './inventory-lot';

const NOW = new Date('2026-09-17T00:00:00.000Z');

const lotProps = {
  id: 'lot_1',
  variantId: 'var_1',
  lotCode: 'L2609',
  onHand: 10,
  expiresOn: new Date('2027-01-31T00:00:00.000Z'),
};

describe('InventoryLot - available quantity', () => {
  it('should report everything as available for a fresh lot', () => {
    // arrange
    const clock = new FixedClock(NOW);
    const lot = InventoryLot.create(lotProps);

    // confirm
    expect(lot.onHand).toBe(10);

    // act
    const available = lot.availableAt(clock);

    // assert
    expect(available).toBe(10);
  });

  it('should exclude reserved units from the available quantity', () => {
    // arrange
    const clock = new FixedClock(NOW);
    const lot = InventoryLot.create(lotProps);
    lot.reserve(4);

    // confirm
    expect(lot.reserved).toBe(4);

    // act
    const available = lot.availableAt(clock);

    // assert
    expect(available).toBe(6);
    expect(lot.onHand).toBe(10);
  });

  it('should report nothing available once the lot is blocked', () => {
    // arrange
    const clock = new FixedClock(NOW);
    const lot = InventoryLot.create(lotProps);

    // confirm
    expect(lot.availableAt(clock)).toBe(10);

    // act
    lot.block('Nghi ngờ hàng lỗi');

    // assert
    expect(lot.availableAt(clock)).toBe(0);
  });

  it('should report nothing available once the lot has expired', () => {
    // arrange
    const clock = new FixedClock(NOW);
    const lot = InventoryLot.create(lotProps);

    // confirm
    expect(lot.availableAt(clock)).toBe(10);

    // act
    clock.advanceBy(200 * 24 * 60 * 60 * 1000);

    // assert
    expect(lot.availableAt(clock)).toBe(0);
  });
});

describe('InventoryLot - reservation invariants', () => {
  it('should never reserve more than what is on hand', () => {
    // arrange
    const lot = InventoryLot.create(lotProps);
    lot.reserve(8);

    // confirm
    expect(lot.reserved).toBe(8);

    // act
    const act = () => lot.reserve(3);

    // assert
    expect(act).toThrow(/OUT_OF_STOCK/);
    expect(lot.reserved).toBe(8);
    expect(lot.onHand).toBe(10);
  });

  it('should refuse to reserve from a blocked lot', () => {
    // arrange
    const lot = InventoryLot.create(lotProps);
    lot.block('Nghi ngờ hàng lỗi');

    // confirm
    expect(lot.isBlocked()).toBe(true);

    // act
    const act = () => lot.reserve(1);

    // assert
    expect(act).toThrow(/LOT_BLOCKED/);
    expect(lot.reserved).toBe(0);
  });

  it('should allow reserving again after the lot is unblocked', () => {
    // arrange
    const lot = InventoryLot.create(lotProps);
    lot.block('Nghi ngờ hàng lỗi');

    // confirm
    expect(() => lot.reserve(1)).toThrow(/LOT_BLOCKED/);

    // act
    lot.unblock();
    lot.reserve(1);

    // assert
    expect(lot.isBlocked()).toBe(false);
    expect(lot.reserved).toBe(1);
  });

  it('should reject a non-positive reservation', () => {
    // arrange
    const lot = InventoryLot.create(lotProps);

    // confirm
    expect(lot.reserved).toBe(0);

    // act
    const act = () => lot.reserve(0);

    // assert
    expect(act).toThrow(/INVALID_QUANTITY/);
    expect(lot.reserved).toBe(0);
  });

  it('should give reserved units back when a reservation is released', () => {
    // arrange
    const lot = InventoryLot.create(lotProps);
    lot.reserve(4);

    // confirm
    expect(lot.reserved).toBe(4);

    // act
    lot.release(3);

    // assert
    expect(lot.reserved).toBe(1);
    expect(lot.onHand).toBe(10);
  });

  it('should refuse to release more than is reserved', () => {
    // arrange
    const lot = InventoryLot.create(lotProps);
    lot.reserve(2);

    // confirm
    expect(lot.reserved).toBe(2);

    // act
    const act = () => lot.release(3);

    // assert
    expect(act).toThrow(/INVALID_RELEASE/);
    expect(lot.reserved).toBe(2);
  });

  it('should remove units from stock when a reservation is picked', () => {
    // arrange
    const lot = InventoryLot.create(lotProps);
    lot.reserve(4);

    // confirm
    expect(lot.onHand).toBe(10);

    // act
    lot.issue(4);

    // assert
    expect(lot.onHand).toBe(6);
    expect(lot.reserved).toBe(0);
  });

  it('should refuse to issue more than is reserved', () => {
    // arrange
    const lot = InventoryLot.create(lotProps);
    lot.reserve(1);

    // confirm
    expect(lot.reserved).toBe(1);

    // act
    const act = () => lot.issue(2);

    // assert
    expect(act).toThrow(/INVALID_ISSUE/);
    expect(lot.onHand).toBe(10);
    expect(lot.reserved).toBe(1);
  });
});

describe('InventoryLot - encapsulation', () => {
  it('should expose no writable own properties', () => {
    // arrange
    const lot = InventoryLot.create(lotProps);

    // confirm
    expect(lot.onHand).toBe(10);

    // act
    const ownKeys = Object.keys(lot);

    // assert
    expect(ownKeys).toEqual([]);
  });

  it('should not leak the internal expiry Date', () => {
    // arrange
    const lot = InventoryLot.create(lotProps);
    const clock = new FixedClock(NOW);

    // confirm
    expect(lot.availableAt(clock)).toBe(10);

    // act
    lot.expiresOn?.setFullYear(2000);

    // assert
    expect(lot.availableAt(clock)).toBe(10);
  });
});
