/**
 * Nguồn thời gian được inject. Domain không bao giờ gọi `new Date()` trực tiếp,
 * nhờ vậy mọi quy tắc phụ thuộc thời gian (hạn dùng, hết hạn giữ hàng) đều test được.
 */
export interface Clock {
  now(): Date;
}

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

/** Đồng hồ giả cho test: cố định một mốc, chỉ tiến khi được yêu cầu. */
export class FixedClock implements Clock {
  #epochMillis: number;

  constructor(instant: Date) {
    this.#epochMillis = instant.getTime();
  }

  now(): Date {
    return new Date(this.#epochMillis);
  }

  advanceBy(millis: number): void {
    this.#epochMillis += millis;
  }
}
