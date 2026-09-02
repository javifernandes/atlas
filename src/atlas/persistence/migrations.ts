import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import type { Pool } from 'pg';

type MigrationRow = {
  checksum: string;
  name: string;
};

export type AtlasMigrationResult = {
  applied: string[];
  skipped: string[];
};

const migrationChecksum = (sql: string) =>
  createHash('sha256').update(sql).digest('hex');

export const defaultAtlasMigrationsDirectory = path.resolve(
  process.cwd(),
  'migrations',
);

export const runAtlasMigrations = async (input: {
  migrationsDirectory?: string;
  pool: Pick<Pool, 'connect'>;
}): Promise<AtlasMigrationResult> => {
  const migrationsDirectory = input.migrationsDirectory ?? defaultAtlasMigrationsDirectory;
  const migrationNames = (await readdir(migrationsDirectory))
    .filter(name => /^\d+.*\.sql$/.test(name))
    .sort((left, right) => left.localeCompare(right));
  const client = await input.pool.connect();
  const result: AtlasMigrationResult = { applied: [], skipped: [] };

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS atlas_migrations (
        name text PRIMARY KEY,
        checksum text NOT NULL,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await client.query("SELECT pg_advisory_lock(hashtext('atlas:migrations'))");

    const existingResult = await client.query<MigrationRow>(
      'SELECT name, checksum FROM atlas_migrations ORDER BY name',
    );
    const existing = new Map(
      existingResult.rows.map(migration => [migration.name, migration.checksum]),
    );

    for (const name of migrationNames) {
      const sql = await readFile(path.join(migrationsDirectory, name), 'utf8');
      const checksum = migrationChecksum(sql);
      const previousChecksum = existing.get(name);

      if (previousChecksum) {
        if (previousChecksum !== checksum) {
          throw new Error(`Applied Atlas migration ${name} has changed.`);
        }

        result.skipped.push(name);
        continue;
      }

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO atlas_migrations (name, checksum) VALUES ($1, $2)',
          [name, checksum],
        );
        await client.query('COMMIT');
        result.applied.push(name);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }

    return result;
  } finally {
    try {
      await client.query("SELECT pg_advisory_unlock(hashtext('atlas:migrations'))");
    } finally {
      client.release();
    }
  }
};
