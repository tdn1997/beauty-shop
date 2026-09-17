import { describe, expect, it } from 'vitest';

import { Money } from '../../shared/domain/money';
import { Address } from './address';
import { Order, OrderStatus } from './order';

const address = Address.create({
  recipientName: 'Nguyễn Văn A',
  phone: '0901234567',
  line1: '12 Lý Thường Kiệt',
  ward: 'Phường 7',
  district: 'Quận 10',
  province: 'TP. Hồ Chí Minh',
});

const serum = {
  variantId: 'var_1',
  sku: 'SRM-VTC-30',
  nameSnapshot: 'Serum Vitamin C 30ml',
  unitPriceSnapshot: Money.parse('459000', 'VND'),
  quantity: 2,
};

const mask = {
  variantId: 'var_2',
  sku: 'MSK-CLY-100',
  nameSnapshot: 'Mặt nạ đất sét 100g',
  unitPriceSnapshot: Money.parse('180000', 'VND'),
  quantity: 1,
};

function draftOrder(): Order {
  return Order.draft({ id: 'ord_1', customerId: 'cus_1', currency: 'VND' });
}

function orderReadyToConfirm(): Order {
  const order = draftOrder();
  order.addQuotedLine(serum);
  order.shipTo(address);
  return order;
}

describe('Order - creation', () => {
  it('should start as a draft with no lines', () => {
    // arrange
    const props = { id: 'ord_1', customerId: 'cus_1', currency: 'VND' } as const;

    // confirm
    expect(props.id).toBe('ord_1');

    // act
    const order = Order.draft(props);

    // assert
    expect(order.status).toBe(OrderStatus.Draft);
    expect(order.lines).toEqual([]);
    expect(order.itemsTotal().toString()).toBe('0 VND');
  });

  it('should expose no writable own properties', () => {
    // arrange
    const order = draftOrder();

    // confirm
    expect(order.id).toBe('ord_1');

    // act
    const ownKeys = Object.keys(order);

    // assert
    expect(ownKeys).toEqual([]);
  });
});

describe('Order - lines are encapsulated', () => {
  it('should create its own lines rather than accepting built ones', () => {
    // arrange
    const order = draftOrder();

    // confirm
    expect(order.lines).toHaveLength(0);

    // act
    order.addQuotedLine(serum);

    // assert
    expect(order.lines).toHaveLength(1);
    expect(order.lines[0]?.sku).toBe('SRM-VTC-30');
  });

  it('should hand out a frozen snapshot of its lines', () => {
    // arrange
    const order = draftOrder();
    order.addQuotedLine(serum);

    // confirm
    expect(order.lines).toHaveLength(1);

    // act
    const lines = order.lines;

    // assert
    expect(Object.isFrozen(lines)).toBe(true);
    expect(() => (lines as unknown as unknown[]).push(mask)).toThrow();
    expect(order.lines).toHaveLength(1);
  });

  it('should not be affected by a caller mutating a previously returned snapshot', () => {
    // arrange
    const order = draftOrder();
    order.addQuotedLine(serum);
    const firstSnapshot = order.lines;

    // confirm
    expect(firstSnapshot).toHaveLength(1);

    // act
    order.addQuotedLine(mask);

    // assert
    expect(firstSnapshot).toHaveLength(1);
    expect(order.lines).toHaveLength(2);
  });
});

describe('Order - totals', () => {
  it('should sum the subtotals of every line', () => {
    // arrange
    const order = draftOrder();
    order.addQuotedLine(serum);

    // confirm
    expect(order.itemsTotal().toString()).toBe('918000 VND');

    // act
    order.addQuotedLine(mask);

    // assert
    expect(order.itemsTotal().toString()).toBe('1098000 VND');
  });

  it('should refuse a line quoted in a different currency', () => {
    // arrange
    const order = draftOrder();

    // confirm
    expect(order.lines).toHaveLength(0);

    // act
    const act = () =>
      order.addQuotedLine({ ...mask, unitPriceSnapshot: Money.parse('19.99', 'USD') });

    // assert
    expect(act).toThrow(/CURRENCY_MISMATCH/);
    expect(order.lines).toHaveLength(0);
  });

  it('should merge a repeated variant quoted at the same price', () => {
    // arrange
    const order = draftOrder();
    order.addQuotedLine(serum);

    // confirm
    expect(order.lines[0]?.quantity).toBe(2);

    // act
    order.addQuotedLine({ ...serum, quantity: 1 });

    // assert
    expect(order.lines).toHaveLength(1);
    expect(order.lines[0]?.quantity).toBe(3);
    expect(order.itemsTotal().toString()).toBe('1377000 VND');
  });

  it('should refuse a repeated variant quoted at a different price', () => {
    // arrange
    const order = draftOrder();
    order.addQuotedLine(serum);

    // confirm
    expect(order.lines[0]?.unitPriceSnapshot.toString()).toBe('459000 VND');

    // act
    const act = () =>
      order.addQuotedLine({ ...serum, unitPriceSnapshot: Money.parse('399000', 'VND') });

    // assert
    expect(act).toThrow(/PRICE_CHANGED/);
    expect(order.lines[0]?.quantity).toBe(2);
  });

  it('should change the quantity of an existing line', () => {
    // arrange
    const order = draftOrder();
    order.addQuotedLine(serum);

    // confirm
    expect(order.itemsTotal().toString()).toBe('918000 VND');

    // act
    order.changeLineQuantity('var_1', 4);

    // assert
    expect(order.itemsTotal().toString()).toBe('1836000 VND');
  });

  it('should report an unknown variant when changing a quantity', () => {
    // arrange
    const order = draftOrder();
    order.addQuotedLine(serum);

    // confirm
    expect(order.lines).toHaveLength(1);

    // act
    const act = () => order.changeLineQuantity('var_999', 4);

    // assert
    expect(act).toThrow(/LINE_NOT_FOUND/);
  });

  it('should remove a line', () => {
    // arrange
    const order = draftOrder();
    order.addQuotedLine(serum);
    order.addQuotedLine(mask);

    // confirm
    expect(order.lines).toHaveLength(2);

    // act
    order.removeLine('var_1');

    // assert
    expect(order.lines).toHaveLength(1);
    expect(order.itemsTotal().toString()).toBe('180000 VND');
  });
});

describe('Order - confirmation rules', () => {
  it('should refuse to confirm an order with no lines', () => {
    // arrange
    const order = draftOrder();
    order.shipTo(address);

    // confirm
    expect(order.lines).toHaveLength(0);

    // act
    const act = () => order.confirm();

    // assert
    expect(act).toThrow(/EMPTY_ORDER/);
    expect(order.status).toBe(OrderStatus.Draft);
  });

  it('should refuse to confirm an order with no shipping address', () => {
    // arrange
    const order = draftOrder();
    order.addQuotedLine(serum);

    // confirm
    expect(order.lines).toHaveLength(1);

    // act
    const act = () => order.confirm();

    // assert
    expect(act).toThrow(/MISSING_SHIPPING_ADDRESS/);
    expect(order.status).toBe(OrderStatus.Draft);
  });

  it('should confirm an order that has lines and an address', () => {
    // arrange
    const order = orderReadyToConfirm();

    // confirm
    expect(order.status).toBe(OrderStatus.Draft);

    // act
    order.confirm();

    // assert
    expect(order.status).toBe(OrderStatus.Confirmed);
  });

  it('should keep a snapshot of the address rather than a live reference', () => {
    // arrange
    const order = orderReadyToConfirm();

    // confirm
    expect(order.shippingAddress?.toJSON().district).toBe('Quận 10');

    // act
    const snapshot = order.shippingAddress;

    // assert
    expect(snapshot).not.toBe(address);
    expect(snapshot?.equals(address)).toBe(true);
  });
});

describe('Order - state machine', () => {
  it('should refuse to confirm twice', () => {
    // arrange
    const order = orderReadyToConfirm();
    order.confirm();

    // confirm
    expect(order.status).toBe(OrderStatus.Confirmed);

    // act
    const act = () => order.confirm();

    // assert
    expect(act).toThrow(/INVALID_TRANSITION/);
    expect(order.status).toBe(OrderStatus.Confirmed);
  });

  it('should refuse to change lines once confirmed', () => {
    // arrange
    const order = orderReadyToConfirm();
    order.confirm();

    // confirm
    expect(order.lines).toHaveLength(1);

    // act
    const act = () => order.addQuotedLine(mask);

    // assert
    expect(act).toThrow(/INVALID_TRANSITION/);
    expect(order.lines).toHaveLength(1);
  });

  it('should walk confirmed to paid to dispatched', () => {
    // arrange
    const order = orderReadyToConfirm();
    order.confirm();

    // confirm
    expect(order.status).toBe(OrderStatus.Confirmed);

    // act
    order.markPaid();
    order.dispatch();

    // assert
    expect(order.status).toBe(OrderStatus.Dispatched);
  });

  it('should refuse to dispatch an unpaid order', () => {
    // arrange
    const order = orderReadyToConfirm();
    order.confirm();

    // confirm
    expect(order.status).toBe(OrderStatus.Confirmed);

    // act
    const act = () => order.dispatch();

    // assert
    expect(act).toThrow(/INVALID_TRANSITION/);
    expect(order.status).toBe(OrderStatus.Confirmed);
  });

  it('should allow cancelling a confirmed order', () => {
    // arrange
    const order = orderReadyToConfirm();
    order.confirm();

    // confirm
    expect(order.status).toBe(OrderStatus.Confirmed);

    // act
    order.cancel('Khách đổi ý');

    // assert
    expect(order.status).toBe(OrderStatus.Cancelled);
    expect(order.cancellationReason).toBe('Khách đổi ý');
  });

  it('should refuse to cancel an order already on the way', () => {
    // arrange
    const order = orderReadyToConfirm();
    order.confirm();
    order.markPaid();
    order.dispatch();

    // confirm
    expect(order.status).toBe(OrderStatus.Dispatched);

    // act
    const act = () => order.cancel('Khách đổi ý');

    // assert
    expect(act).toThrow(/INVALID_TRANSITION/);
    expect(order.status).toBe(OrderStatus.Dispatched);
  });
});

describe('Order - optimistic locking', () => {
  it('should start at version zero', () => {
    // arrange
    const props = { id: 'ord_1', customerId: 'cus_1', currency: 'VND' } as const;

    // confirm
    expect(props.customerId).toBe('cus_1');

    // act
    const order = Order.draft(props);

    // assert
    expect(order.version).toBe(0);
  });

  it('should bump the version on every state change', () => {
    // arrange
    const order = orderReadyToConfirm();
    const before = order.version;

    // confirm
    expect(before).toBeGreaterThan(0);

    // act
    order.confirm();

    // assert
    expect(order.version).toBe(before + 1);
  });

  it('should not bump the version when a change is rejected', () => {
    // arrange
    const order = orderReadyToConfirm();
    order.confirm();
    const before = order.version;

    // confirm
    expect(order.status).toBe(OrderStatus.Confirmed);

    // act
    expect(() => order.addQuotedLine(mask)).toThrow();

    // assert
    expect(order.version).toBe(before);
  });
});
