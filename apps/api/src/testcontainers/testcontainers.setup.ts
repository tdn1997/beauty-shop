import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { execSync } from 'node:child_process';
import path from 'node:path';

let container: Awaited<ReturnType<PostgreSqlContainer['start']>> | null = null;

export async function startPostgres(): Promise<string> {
  if (container) {
    return container.getConnectionUri();
  }

  container = await new PostgreSqlContainer()
    .withDatabase('beautyshop')
    .withUsername('test')
    .withPassword('test')
    .withExposedPorts(5432)
    .start();

  const connectionString = container.getConnectionUri();

  process.env.DATABASE_URL = connectionString;
  execSync(`npx prisma migrate deploy`, {
    env: { ...process.env, DATABASE_URL: connectionString },
    cwd: path.resolve(__dirname, '../..'),
    stdio: 'pipe',
  });

  return connectionString;
}

export async function stopPostgres(): Promise<void> {
  if (container) {
    await container.stop();
    container = null;
  }
}
