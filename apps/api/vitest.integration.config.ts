import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    globals: false,
    include: ['src/**/*.integration.spec.ts', 'prisma/**/*.integration.spec.ts'],
    environment: 'node',
    testTimeout: 120000,
    hookTimeout: 120000,
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
  },
});
