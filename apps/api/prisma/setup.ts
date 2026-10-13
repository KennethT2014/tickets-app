import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@libsql/client';

const url = process.env.LIBSQL_URL ?? 'http://127.0.0.1:8080';
const here = dirname(fileURLToPath(import.meta.url));

async function waitForDb() {
  const client = createClient({ url });
  for (let i = 0; i < 30; i++) {
    try {
      await client.execute('SELECT 1');
      return client;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  throw new Error(
    `Cannot reach libSQL at ${url}. Start it with: docker compose up -d`,
  );
}

async function main() {
  const client = await waitForDb();
  const existing = await client.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='User'",
  );
  if (existing.rows.length > 0) {
    console.log('Schema already present');
    return;
  }

  const sql = readFileSync(join(here, 'init.sql'), 'utf8');
  const statements = sql
    .split(';')
    .map((statement) => statement.trim())
    .filter(Boolean);

  for (const statement of statements) {
    await client.execute(statement);
  }
  console.log(`Applied ${statements.length} schema statements to ${url}`);
}

await main();
