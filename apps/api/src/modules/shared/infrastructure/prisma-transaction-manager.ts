import { AsyncLocalStorage } from 'node:async_hooks';

import { TransactionManager } from '../application/transaction-manager';

/** Phần duy nhất của Prisma mà lớp này cần — khai báo hẹp để test cắm giả được. */
export interface PrismaTransactional<TClient> {
  $transaction<T>(work: (tx: TClient) => Promise<T>): Promise<T>;
}

/**
 * Cài đặt ranh giới transaction bằng Prisma.
 *
 * `current()` trả client **đang hiệu lực**: transaction hiện hành nếu đang ở
 * trong `run`, không thì kết nối gốc. Nhờ vậy repository không phải nhận thêm
 * tham số `tx` nào — chữ ký của cổng lưu trữ sạch, mà vẫn đúng transaction.
 */
export class PrismaTransactionManager<TClient> implements TransactionManager {
  readonly #root: TClient & PrismaTransactional<TClient>;
  readonly #ambient = new AsyncLocalStorage<TClient>();

  constructor(root: TClient & PrismaTransactional<TClient>) {
    this.#root = root;
  }

  current(): TClient {
    return this.#ambient.getStore() ?? this.#root;
  }

  async run<T>(work: () => Promise<T>): Promise<T> {
    // Đã ở trong một transaction thì nhập vào nó: Prisma không lồng transaction,
    // và ca sử dụng ngoài cùng mới là ranh giới đúng.
    if (this.#ambient.getStore()) return work();

    return this.#root.$transaction((tx) => this.#ambient.run(tx, work));
  }
}
