import type { Pool, PoolClient, QueryResult } from 'pg';
import { describe, expect, it, vi } from 'vitest';

import { createPortableAtlasPostgresPool } from './postgres-portability';

const resultWithDate = () => ({
  command: 'SELECT',
  fields: [],
  oid: 0,
  rowCount: 1,
  rows: [{ id: 'contributor-1', lastContributedAt: new Date('2026-11-01T00:00:00.000Z') }],
}) satisfies QueryResult;

describe('Atlas PostgreSQL protocol portability', () => {
  it('normalizes PostgreSQL timestamps from pool and transaction reads', async () => {
    const query = vi.fn().mockImplementation(async () => resultWithDate());
    const client = { query, release: vi.fn() } as unknown as PoolClient;
    const pool = createPortableAtlasPostgresPool({
      connect: vi.fn(async () => client) as unknown as Pool['connect'],
      query: query as unknown as Pool['query'],
    });

    await expect(pool.query('SELECT last_contributed_at FROM atlas_workspace_contributors'))
      .resolves.toMatchObject({
        rows: [{ lastContributedAt: '2026-11-01T00:00:00.000Z' }],
      });

    const transaction = await pool.connect();
    await expect(transaction.query('SELECT last_contributed_at FROM atlas_workspace_contributors'))
      .resolves.toMatchObject({
        rows: [{ lastContributedAt: '2026-11-01T00:00:00.000Z' }],
      });
  });
});
