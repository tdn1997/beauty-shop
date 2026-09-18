import { DomainError } from '../../shared/domain/domain-error';
import { requirePositiveInteger } from '../../shared/domain/guards';
import { Result } from '../../shared/domain/result';
import { PrismaClientSource } from '../../shared/infrastructure/prisma-client-source';
import { OutboxRepository } from '../application/outbox-repository';
import { OutboxEvent, OutboxEventSnapshot, OutboxStatus } from '../domain/outbox-event';

export interface OutboxEventRow extends OutboxEventSnapshot {}

export interface OutboxPrismaClient {
  outboxEvent: {
    create(args: { data: OutboxEventRow }): Promise<unknown>;
    findMany(args: {
      where: { status: OutboxStatus.Pending };
      orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }];
      take: number;
    }): Promise<readonly OutboxEventRow[]>;
    updateMany(args: {
      where: { id: string; version: number };
      data: Pick<OutboxEventRow, 'status' | 'attempts' | 'lastError' | 'version'>;
    }): Promise<{ count: number }>;
  };
}

export class PrismaOutboxRepository implements OutboxRepository {
  readonly #clients: PrismaClientSource<OutboxPrismaClient>;

  constructor(clients: PrismaClientSource<OutboxPrismaClient>) {
    this.#clients = clients;
  }

  async append(event: OutboxEvent): Promise<Result<void>> {
    await this.#clients.current().outboxEvent.create({ data: event.toSnapshot() });
    event.markPersisted();
    return Result.ok(undefined);
  }

  async findPending(limit: number): Promise<readonly OutboxEvent[]> {
    requirePositiveInteger(limit, 'limit', 'INVALID_BATCH_SIZE');
    const rows = await this.#clients.current().outboxEvent.findMany({
      where: { status: OutboxStatus.Pending },
      orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
      take: limit,
    });
    return Object.freeze(rows.map((row) => OutboxEvent.rehydrate(row)));
  }

  async save(event: OutboxEvent): Promise<Result<void>> {
    if (event.persistedVersion === null) {
      throw new DomainError('INVALID_OUTBOX_EVENT', 'Phải append sự kiện trước khi ghi kết quả gửi');
    }
    const snapshot = event.toSnapshot();
    const { count } = await this.#clients.current().outboxEvent.updateMany({
      where: { id: snapshot.id, version: event.persistedVersion },
      data: {
        status: snapshot.status,
        attempts: snapshot.attempts,
        lastError: snapshot.lastError,
        version: snapshot.version,
      },
    });
    if (count === 0) {
      return Result.err(new DomainError('CONCURRENT_MODIFICATION', 'Sự kiện đã bị thay đổi', {
        eventId: event.id,
        expectedVersion: event.persistedVersion,
      }));
    }
    event.markPersisted();
    return Result.ok(undefined);
  }
}
