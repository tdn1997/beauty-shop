import { requirePositiveInteger } from '../../shared/domain/guards';
import { NotificationPort } from './notification-port';
import { OutboxRepository } from './outbox-repository';

export interface OutboxDispatcherOptions {
  /** Số sự kiện lấy ra mỗi vòng. Có trần để một vòng không kéo cả hộp thư lên. */
  readonly batchSize: number;
  /** Ngân sách thử của mỗi sự kiện — vế "retry giới hạn" của kế hoạch. */
  readonly maxAttempts: number;
}

/** Kết quả một vòng quét, để worker log lại và để test soi được. */
export interface OutboxDispatchReport {
  readonly picked: number;
  readonly sent: number;
  readonly failed: number;
  readonly exhausted: number;
}

/**
 * Bộ não của worker outbox — và **chỉ** bộ não: không hẹn giờ, không Nest,
 * không `setInterval`. Nhờ vậy toàn bộ hành vi thử lại test được bằng lời gọi
 * thẳng, không cần đồng hồ giả hay chờ đợi.
 *
 * Một sự kiện hỏng không được làm hỏng cả mẻ: vòng lặp đi tiếp. Nhưng sự cố
 * **hạ tầng** (cổng gửi ném) thì để nổi lên — nuốt nó đi sẽ biến một provider
 * chết thành một worker chạy êm mà chẳng gửi được gì.
 */
export class OutboxDispatcher {
  readonly #outbox: OutboxRepository;
  readonly #notifications: NotificationPort;
  readonly #batchSize: number;
  readonly #maxAttempts: number;

  constructor(
    outbox: OutboxRepository,
    notifications: NotificationPort,
    options: OutboxDispatcherOptions,
  ) {
    this.#batchSize = requirePositiveInteger(options.batchSize, 'batchSize', 'INVALID_BATCH_SIZE');
    this.#maxAttempts = requirePositiveInteger(
      options.maxAttempts,
      'maxAttempts',
      'INVALID_MAX_ATTEMPTS',
    );
    this.#outbox = outbox;
    this.#notifications = notifications;
  }

  async dispatchPending(): Promise<OutboxDispatchReport> {
    const batch = await this.#outbox.findPending(this.#batchSize);

    let sent = 0;
    let failed = 0;
    let exhausted = 0;

    for (const event of batch) {
      // Sự kiện đã cạn ngân sách thì bỏ qua hẳn: nó là việc của con người, không
      // phải của worker. Không ghi lại gì cả — trạng thái trong DB đã đúng rồi.
      if (!event.canRetry(this.#maxAttempts)) continue;

      const outcome = await this.#notifications.send({
        eventType: event.eventType,
        aggregateId: event.aggregateId,
        payload: event.payload,
      });

      const error = outcome.errorOrNull();
      if (error === null) {
        event.markSent();
      } else {
        event.recordFailure(`${error.code}: ${error.message}`, this.#maxAttempts);
      }

      // Ghi ngay sau từng sự kiện, không gom cuối mẻ: nếu cổng gửi ném ở sự kiện
      // sau, những cái đã gửi xong vẫn được đánh dấu — bằng không lần quét tới
      // sẽ gửi lại chúng lần nữa.
      const saved = await this.#outbox.save(event);
      const saveError = saved.errorOrNull();
      if (saveError?.code === 'CONCURRENT_MODIFICATION') continue;
      if (saveError !== null) throw saveError;

      if (error === null) sent += 1;
      else if (event.canRetry(this.#maxAttempts)) failed += 1;
      else exhausted += 1;
    }

    return { picked: batch.length, sent, failed, exhausted };
  }
}

