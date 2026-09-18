import { Interval } from '@nestjs/schedule';

import { OutboxDispatcher } from '../application/outbox-dispatcher';

export class OutboxWorker {
  #running = false;

  constructor(
    private readonly dispatcher: Pick<OutboxDispatcher, 'dispatchPending'>,
    private readonly logger: { error(error: unknown): void },
  ) {}

  @Interval(5000)
  async tick(): Promise<void> {
    if (this.#running) return;
    this.#running = true;
    try {
      await this.dispatcher.dispatchPending();
    } catch (error) {
      this.logger.error(error);
    } finally {
      this.#running = false;
    }
  }
}
