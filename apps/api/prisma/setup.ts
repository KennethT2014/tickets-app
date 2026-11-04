import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient, type Client } from '@libsql/client';

const url = process.env.LIBSQL_URL ?? 'http://127.0.0.1:8080';
const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, 'migrations');

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

async function tableExists(client: Client, name: string) {
  const result = await client.execute({
    sql: "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
    args: [name],
  });
  return result.rows.length > 0;
}

/** Baseline schema (init.sql) is only applied to an empty database. */
async function applyBaseline(client: Client) {
  if (await tableExists(client, 'User')) {
    console.log('Baseline schema already present');
    return;
  }
  const sql = readFileSync(join(here, 'init.sql'), 'utf8');
  await client.executeMultiple(sql);
  console.log(`Applied baseline schema to ${url}`);
}

/**
 * Versioned migrations: prisma/migrations/NNN_name.sql, applied once each, in
 * order, inside a write transaction, and recorded in "_migrations".
 */
async function applyMigrations(client: Client) {
  await client.execute(
    'CREATE TABLE IF NOT EXISTS "_migrations" ("id" TEXT NOT NULL PRIMARY KEY, "appliedAt" TEXT NOT NULL)',
  );
  const applied = new Set(
    (await client.execute('SELECT "id" FROM "_migrations"')).rows.map((row) =>
      String(row.id),
    ),
  );
  const files = readdirSync(migrationsDir)
    .filter((file) => /^\d+_.+\.sql$/.test(file))
    .sort();

  let count = 0;
  for (const file of files) {
    const id = file.replace(/\.sql$/, '');
    if (applied.has(id)) continue;
    const sql = readFileSync(join(migrationsDir, file), 'utf8');
    const tx = await client.transaction('write');
    try {
      await tx.executeMultiple(sql);
      await tx.execute({
        sql: 'INSERT INTO "_migrations" ("id", "appliedAt") VALUES (?, ?)',
        args: [id, new Date().toISOString()],
      });
      await tx.commit();
      count += 1;
      console.log(`Applied migration ${id}`);
    } catch (error) {
      await tx.rollback();
      throw new Error(`Migration ${id} failed: ${String(error)}`);
    } finally {
      tx.close();
    }
  }
  console.log(count ? `${count} migration(s) applied` : 'Migrations up to date');
}

async function main() {
  const client = await waitForDb();
  await applyBaseline(client);
  await applyMigrations(client);
  client.close();
}

await main();
