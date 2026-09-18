import 'reflect-metadata';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { describe, expect, it } from 'vitest';

import { OutboxDispatcher } from './application/outbox-dispatcher';
import { NotificationModule, NOTIFICATION_PORT, OUTBOX_REPOSITORY } from './notification.module';

describe('NotificationModule', () => {
  it('should export the repository port and dispatcher without exposing adapters', () => {
    // arrange
    const module = NotificationModule;
    // confirm
    expect(typeof OUTBOX_REPOSITORY).toBe('symbol');
    expect(typeof NOTIFICATION_PORT).toBe('symbol');
    // act
    const exports = Reflect.getMetadata(MODULE_METADATA.EXPORTS, module);
    // assert
    expect(exports).toEqual([OUTBOX_REPOSITORY, OutboxDispatcher]);
  });
});
