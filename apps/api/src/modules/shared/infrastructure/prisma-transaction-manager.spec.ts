import { describe, expect, it } from 'vitest';

import { PrismaTransactionManager } from './prisma-transaction-manager';

interface FakeClient {
  readonly label: string;
}

/**
 * Giả lập đúng phần `$transaction` mà transaction manager dựa vào:
 * mở một client con, và nếu công việc ném lỗi thì rollback rồi ném tiếp.
 */
class FakeRoot implements FakeClient {
  readonly label = 'root';
  opened = 0;
  committed = 0;
  rolledBack = 0;

  async $transaction<T>(work: (tx: FakeClient) => Promise<T>): Promise<T> {
    this.opened += 1;
    try {
      const result = await work({ label: `tx-${this.opened}` });
      this.committed += 1;
      return result;
    } catch (error) {
      this.rolledBack += 1;
      throw error;
    }
  }
}

describe('PrismaTransactionManager', () => {
  it('should run the work inside a single transaction', async () => {
    // arrange
    const root = new FakeRoot();
    const transactions = new PrismaTransactionManager<FakeClient>(root);

    // confirm
    expect(root.opened).toBe(0);

    // act
    await transactions.run(async () => undefined);

    // assert
    expect(root.opened).toBe(1);
    expect(root.committed).toBe(1);
  });

  it('should hand out the transaction client while the work runs', async () => {
    // arrange
    const root = new FakeRoot();
    const transactions = new PrismaTransactionManager<FakeClient>(root);

    // confirm
    expect(transactions.current().label).toBe('root');

    // act
    const seen = await transactions.run(async () => transactions.current().label);

    // assert
    expect(seen).toBe('tx-1');
  });

  it('should go back to the root client once the work is done', async () => {
    // arrange
    const root = new FakeRoot();
    const transactions = new PrismaTransactionManager<FakeClient>(root);

    // confirm
    await transactions.run(async () => expect(transactions.current().label).toBe('tx-1'));

    // act
    const after = transactions.current().label;

    // assert
    expect(after).toBe('root');
  });

  it('should reuse the open transaction instead of nesting a second one', async () => {
    // arrange
    const root = new FakeRoot();
    const transactions = new PrismaTransactionManager<FakeClient>(root);

    // confirm
    expect(root.opened).toBe(0);

    // act
    const inner = await transactions.run(async () =>
      transactions.run(async () => transactions.current().label),
    );

    // assert
    expect(root.opened).toBe(1);
    expect(inner).toBe('tx-1');
  });

  it('should let a failure roll the transaction back instead of swallowing it', async () => {
    // arrange
    const root = new FakeRoot();
    const transactions = new PrismaTransactionManager<FakeClient>(root);
    const boom = new Error('mất kết nối');

    // confirm
    expect(root.rolledBack).toBe(0);

    // act
    const act = transactions.run(async () => {
      throw boom;
    });

    // assert
    await expect(act).rejects.toBe(boom);
    expect(root.rolledBack).toBe(1);
    expect(root.committed).toBe(0);
  });
});
