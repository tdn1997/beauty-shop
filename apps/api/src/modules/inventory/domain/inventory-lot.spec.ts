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

describe('InventoryLot - persistence snapshot', () => {
  it('should describe every stored field in its snapshot', () => {
    // arrange
    const lot = InventoryLot.create(lotProps);
    lot.reserve(3);

    // confirm
    expect(lot.reserved).toBe(3);

    // act
    const snapshot = lot.toSnapshot();

    // assert
    expect(snapshot).toEqual({
      id: 'lot_1',
      variantId: 'var_1',
      lotCode: 'L2609',
      onHand: 10,
      reserved: 3,
      expiresOn: new Date('2027-01-31T00:00:00.000Z'),
      blocked: false,
      blockReason: null,
      version: lot.version,
    });
  });

  it('should round-trip a blocked lot through rehydrate', () => {
    // arrange
    const lot = InventoryLot.create(lotProps);
    lot.reserve(4);
    lot.block('Nghi ngờ hỏng bao bì');

    // confirm
    expect(lot.isBlocked()).toBe(true);

    // act
    const restored = InventoryLot.rehydrate(lot.toSnapshot());

    // assert
    expect(restored.toSnapshot()).toEqual(lot.toSnapshot());
  });

  it('should copy the expiry date out of the snapshot', () => {
    // arrange
    const lot = InventoryLot.create(lotProps);
    const snapshot = lot.toSnapshot();

    // confirm
    expect(snapshot.expiresOn).not.toBeNull();

    // act
    (snapshot.expiresOn as Date).setFullYear(1999);

    // assert
    expect(lot.expiresOn?.getFullYear()).toBe(2027);
  });

  it('should still guard the stock invariant after rehydrate', () => {
    // arrange
    const lot = InventoryLot.create({ ...lotProps, onHand: 5 });
    lot.reserve(5);
    const restored = InventoryLot.rehydrate(lot.toSnapshot());
    const before = restored.toSnapshot();

    // confirm
    expect(restored.reserved).toBe(5);

    // act
    const act = () => restored.reserve(1);

    // assert
    expect(act).toThrow(/OUT_OF_STOCK/);
    expect(restored.toSnapshot()).toEqual(before);
  });
});

describe('InventoryLot - optimistic locking', () => {
  it('should start at version zero', () => {
    // arrange
    const props = lotProps;

    // confirm
    expect(props.onHand).toBe(10);

    // act
    const lot = InventoryLot.create(props);

    // assert
    expect(lot.version).toBe(0);
  });

  it('should bump the version on every state change', () => {
    // arrange
    const lot = InventoryLot.create(lotProps);
    const before = lot.version;

    // confirm
    expect(before).toBe(0);

    // act
    lot.reserve(2);

    // assert
    expect(lot.version).toBe(before + 1);
  });

  it('should not bump the version when a reservation is rejected', () => {
    // arrange
    const lot = InventoryLot.create({ ...lotProps, onHand: 1 });
    const before = lot.version;

    // confirm
    expect(lot.availableAt(new FixedClock(NOW))).toBe(1);

    // act
    expect(() => lot.reserve(2)).toThrow(/OUT_OF_STOCK/);

    // assert
    expect(lot.version).toBe(before);
  });

  it('should have no persisted version before it is ever stored', () => {
    // arrange
    const lot = InventoryLot.create(lotProps);

    // confirm
    expect(lot.version).toBe(0);

    // act
    const persisted = lot.persistedVersion;

    // assert
    expect(persisted).toBeNull();
  });

  it('should leave the persisted version behind after a later change', () => {
    // arrange
    const lot = InventoryLot.rehydrate(InventoryLot.create(lotProps).toSnapshot());
    const stored = lot.persistedVersion;

    // confirm
    expect(stored).toBe(lot.version);

    // act
    lot.reserve(1);

    // assert
    expect(lot.persistedVersion).toBe(stored);
    expect(lot.version).toBe((stored as number) + 1);
  });
});
