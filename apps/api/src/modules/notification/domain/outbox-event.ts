import { Clock } from '../../shared/domain/clock';
import { DomainError } from '../../shared/domain/domain-error';
import {
  requireNonBlank,
  requireNonNegativeInteger,
  requirePositiveInteger,
  requireState,
} from '../../shared/domain/guards';

export enum OutboxStatus {
  Pending = 'PENDING',
  Sent = 'SENT',
  Failed = 'FAILED',
}

export interface RecordOutboxEventProps {
  readonly id: string;
  readonly eventType: string;
  readonly aggregateId: string;
  readonly payload: Readonly<Record<string, unknown>>;
}

/**
 * Hình dạng lưu trữ của một sự kiện outbox — hợp đồng giữa aggregate và repository.
 * Repository dịch snapshot này sang hàng trong bảng `outbox_event`, không đọc `#private`.
 */
export interface OutboxEventSnapshot {
  readonly id: string;
  readonly eventType: string;
  readonly aggregateId: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly occurredAt: Date;
  readonly status: OutboxStatus;
  readonly attempts: number;
  readonly lastError: string | null;
  readonly version: number;
}

/** Chỉ sự kiện còn chờ gửi mới được chuyển trạng thái; `SENT`/`FAILED` là điểm dừng. */
const IN_FLIGHT: readonly OutboxStatus[] = [OutboxStatus.Pending];

/**
 * Một dòng trong hộp thư đi (transactional outbox).
 *
 * Lý do tồn tại: việc ghi đơn và việc "đã hứa gửi thông báo" phải cùng nằm trong
 * **một** transaction. Gửi thật (email/SMS) là lời gọi ra ngoài, không được phép
 * nằm trong transaction đó — nên ở đây ta chỉ *ghi lại lời hứa*, còn worker gửi sau.
 * Nhờ vậy không bao giờ có đơn không kèm thông báo, cũng không có thông báo cho
 * một đơn đã rollback.
 *
 * `recordFailure` đếm số lần thử và tự chốt `FAILED` khi cạn ngân sách — đó là
 * "retry giới hạn": một địa chỉ email chết không được làm worker quay vòng mãi mãi.
 */
export class OutboxEvent {
  readonly #id: string;
  readonly #eventType: string;
  readonly #aggregateId: string;
  readonly #payload: Readonly<Record<string, unknown>>;
  readonly #occurredAt: Date;
  #status: OutboxStatus;
  #attempts: number;
  #lastError: string | null;
  #version: number;
  #persistedVersion: number | null;

  private constructor(props: {
    id: string;
    eventType: string;
    aggregateId: string;
    payload: Readonly<Record<string, unknown>>;
    occurredAt: Date;
  }) {
    this.#id = props.id;
    this.#eventType = props.eventType;
    this.#aggregateId = props.aggregateId;
    this.#payload = props.payload;
    this.#occurredAt = structuredClone(props.occurredAt);
    this.#status = OutboxStatus.Pending;
    this.#attempts = 0;
    this.#lastError = null;
    this.#version = 0;
    this.#persistedVersion = null;
  }

  static record(props: RecordOutboxEventProps, clock: Clock): OutboxEvent {
    const id = requireNonBlank(props.id, 'id', 'INVALID_OUTBOX_EVENT');
    const eventType = requireNonBlank(props.eventType, 'eventType', 'INVALID_OUTBOX_EVENT');
    const aggregateId = requireNonBlank(props.aggregateId, 'aggregateId', 'INVALID_OUTBOX_EVENT');

    return new OutboxEvent({
      id,
      eventType,
      aggregateId,
      // Chụp lại nội dung: người gọi sửa object của họ sau đó cũng không đổi được
      // thứ sẽ được gửi đi. Sự kiện là *chuyện đã xảy ra*, không phải một tham chiếu sống.
      payload: freezeDeep(props.payload),
      occurredAt: clock.now(),
    });
  }

  /**
   * Dựng lại sự kiện đã lưu. **Chỉ repository được gọi** — đây là đường duy nhất
   * đặt thẳng trạng thái mà không đi qua máy trạng thái.
   */
  static rehydrate(snapshot: OutboxEventSnapshot): OutboxEvent {
    const event = new OutboxEvent({
      id: requireNonBlank(snapshot.id, 'id', 'INVALID_OUTBOX_EVENT'),
      eventType: requireNonBlank(snapshot.eventType, 'eventType', 'INVALID_OUTBOX_EVENT'),
      aggregateId: requireNonBlank(snapshot.aggregateId, 'aggregateId', 'INVALID_OUTBOX_EVENT'),
      payload: freezeDeep(snapshot.payload),
      occurredAt: structuredClone(snapshot.occurredAt),
    });

    const attempts = requireNonNegativeInteger(
      snapshot.attempts,
      'attempts',
      'INVALID_OUTBOX_EVENT',
    );
    if (snapshot.status === OutboxStatus.Failed && snapshot.lastError === null) {
      // Cùng một luật với CHECK trong migration: đã bỏ cuộc thì phải nói được vì sao.
      throw new DomainError('INVALID_OUTBOX_EVENT', 'Sự kiện đã bỏ cuộc phải kèm lý do', {
        eventId: snapshot.id,
      });
    }

    event.#status = snapshot.status;
    event.#attempts = attempts;
    event.#lastError = snapshot.lastError;
    event.#version = snapshot.version;
    event.#persistedVersion = snapshot.version;

    return event;
  }

  get id(): string {
    return this.#id;
  }

  get eventType(): string {
    return this.#eventType;
  }

  get aggregateId(): string {
    return this.#aggregateId;
  }

  /** Nội dung đã đông cứng sâu: không ai ghi xuyên qua getter này được. */
  get payload(): Readonly<Record<string, unknown>> {
    return freezeDeep(this.#payload);
  }

  /** Trả bản sao: người gọi sửa Date nhận được cũng không đụng tới sự kiện. */
  get occurredAt(): Date {
    return structuredClone(this.#occurredAt);
  }

  get status(): OutboxStatus {
    return this.#status;
  }

  get attempts(): number {
    return this.#attempts;
  }

  get lastError(): string | null {
    return this.#lastError;
  }

  get version(): number {
    return this.#version;
  }

  /**
   * Phiên bản đang nằm trong DB theo hiểu biết của thể hiện này — `null` nếu
   * sự kiện chưa từng được lưu. Đây là vế `WHERE version = ?` của optimistic lock.
   */
  get persistedVersion(): number | null {
    return this.#persistedVersion;
  }

  /** Worker hỏi trước khi gửi lại: còn chờ gửi và chưa cạn ngân sách thử. */
  canRetry(maxAttempts: number): boolean {
    requirePositiveInteger(maxAttempts, 'maxAttempts', 'INVALID_MAX_ATTEMPTS');
    return this.#status === OutboxStatus.Pending && this.#attempts < maxAttempts;
  }

  markSent(): void {
    requireState(this.#status, IN_FLIGHT, 'markSent');
    this.#status = OutboxStatus.Sent;
    this.#touch();
  }

  /**
   * Một lần gửi hỏng. Vẫn để `PENDING` để lần sau thử lại, trừ khi đã dùng hết
   * ngân sách thử — lúc đó chốt `FAILED` vĩnh viễn, có người thật vào xem.
   */
  recordFailure(reason: string, maxAttempts: number): void {
    requireState(this.#status, IN_FLIGHT, 'recordFailure');
    requirePositiveInteger(maxAttempts, 'maxAttempts', 'INVALID_MAX_ATTEMPTS');
    const lastError = requireNonBlank(reason, 'reason', 'INVALID_OUTBOX_EVENT');

    this.#attempts += 1;
    this.#lastError = lastError;
    if (this.#attempts >= maxAttempts) {
      this.#status = OutboxStatus.Failed;
    }
    this.#touch();
  }

  /** Bản chụp để lưu trữ. `payload` đã đông cứng, `occurredAt` là bản sao. */
  toSnapshot(): OutboxEventSnapshot {
    return {
      id: this.#id,
      eventType: this.#eventType,
      aggregateId: this.#aggregateId,
      payload: freezeDeep(this.#payload),
      occurredAt: structuredClone(this.#occurredAt),
      status: this.#status,
      attempts: this.#attempts,
      lastError: this.#lastError,
      version: this.#version,
    };
  }

  /** Repository báo đã ghi xong: `version` hiện tại chính là thứ nằm trong DB. */
  markPersisted(): void {
    this.#persistedVersion = this.#version;
  }

  #touch(): void {
    this.#version += 1;
  }
}

/**
 * Sao chép **sâu** rồi đông cứng. Chỉ đông cứng lớp ngoài là chưa đủ: người gọi
 * vẫn còn tham chiếu tới các object lồng bên trong và sửa được nội dung sẽ gửi đi.
 */
function freezeDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return Object.freeze(value.map((item) => freezeDeep(item))) as unknown as T;
  }
  if (value instanceof Date) {
    return Object.freeze(structuredClone(value)) as unknown as T;
  }
  if (typeof value === 'object' && value !== null) {
    const copy: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      copy[key] = freezeDeep(item);
    }
    return Object.freeze(copy) as unknown as T;
  }
  return value;
}
