import { describe, expect, it } from 'vitest';

import { LogNotificationAdapter } from './log-notification.adapter';

const notification = {
  eventType: 'ORDER_CONFIRMED',
  aggregateId: 'ord_1',
  payload: { orderId: 'ord_1' },
};

describe('LogNotificationAdapter', () => {
  it('should send a structured notification to the injected sink', async () => {
    // arrange
    const lines: string[] = [];
    const adapter = new LogNotificationAdapter({
      write: (line) => {
        lines.push(line);
      },
    });
    // confirm
    expect(lines).toEqual([]);
    // act
    const result = await adapter.send(notification);
    // assert
    expect(result.isOk()).toBe(true);
    expect(lines.map((line) => JSON.parse(line))).toEqual([notification]);
  });

  it('should propagate sink failure without modifying the notification', async () => {
    // arrange
    const before = structuredClone(notification);
    const adapter = new LogNotificationAdapter({
      write: () => {
        throw new Error('sink unavailable');
      },
    });
    // confirm
    expect(notification).toEqual(before);
    // act
    const action = adapter.send(notification);
    // assert
    await expect(action).rejects.toThrow('sink unavailable');
    expect(notification).toEqual(before);
  });
});
