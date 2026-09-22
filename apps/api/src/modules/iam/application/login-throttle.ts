export interface LoginThrottle {
  consume(source: string, account: string): { allowed: boolean; retryAfterSeconds: number };
  success(source: string, account: string): void;
}
export class MemoryLoginThrottle implements LoginThrottle {
  readonly #entries = new Map<string, { count: number; reset: number }>();
  constructor(
    private readonly now: () => number = Date.now,
    private readonly limit = 5,
    private readonly windowMs = 60_000,
  ) {}
  consume(source: string, account: string) {
    const key = `${source}:${account}`;
    const now = this.now();
    const current = this.#entries.get(key);
    const entry =
      !current || current.reset <= now ? { count: 0, reset: now + this.windowMs } : current;
    entry.count++;
    this.#entries.set(key, entry);
    return {
      allowed: entry.count <= this.limit,
      retryAfterSeconds: Math.max(1, Math.ceil((entry.reset - now) / 1000)),
    };
  }
  success(source: string, account: string) {
    this.#entries.delete(`${source}:${account}`);
  }
}
