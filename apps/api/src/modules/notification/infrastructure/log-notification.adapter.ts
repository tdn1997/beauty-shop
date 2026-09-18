import { Result } from '../../shared/domain/result';
import { Notification, NotificationPort } from '../application/notification-port';

export interface NotificationLogSink {
  write(line: string): void;
}

/**
 * Đây là bản thay thế tạm thời trung thực, chưa gửi email/SMS thật.
 * Khi có nhà cung cấp, đổi một dòng ở composition root là đủ — lợi ích của Indirection.
 */
export class LogNotificationAdapter implements NotificationPort {
  readonly #sink: NotificationLogSink;

  constructor(sink: NotificationLogSink) {
    this.#sink = sink;
  }

  async send(notification: Notification): Promise<Result<void>> {
    this.#sink.write(JSON.stringify(notification));
    return Result.ok(undefined);
  }
}
