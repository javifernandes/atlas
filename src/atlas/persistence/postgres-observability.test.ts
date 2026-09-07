import type { Pool, PoolClient, QueryResult } from 'pg';
import { describe, expect, it, vi } from 'vitest';

import {
  instrumentAtlasPostgresPool,
  shouldObserveAtlasPostgresQueries,
  withAtlasPostgresQueryContext,
  type AtlasPostgresQueryObservation,
} from './postgres-observability';

describe('Atlas PostgreSQL query observability', () => {
  it('records result size and request context without SQL values or row content', async () => {
    const query = vi.fn().mockResolvedValue({
      command: 'SELECT',
      fields: [],
      oid: 0,
      rowCount: 1,
      rows: [{ id: 'projection:1', snapshotJson: 'large-private-payload' }],
    } satisfies QueryResult);
    const client = { query, release: vi.fn() } as unknown as PoolClient;
    const observations: AtlasPostgresQueryObservation[] = [];
    const pool = instrumentAtlasPostgresPool(
      {
        connect: vi.fn(async () => client) as unknown as Pool['connect'],
        query: query as unknown as Pool['query'],
      },
      { enabled: true, observe: observation => observations.push(observation) },
    );

    await withAtlasPostgresQueryContext(
      { operation: 'atlas.projection.snapshot.read', trigger: 'page' },
      () =>
        pool.query(
          'SELECT "id", "snapshot_json" FROM "projection_revisions" WHERE "id" = $1',
          ['projection:1'],
        ),
    );

    expect(observations).toEqual([
      expect.objectContaining({
        event: 'atlas.postgres.query',
        operation: 'atlas.projection.snapshot.read',
        payloadBytes: expect.any(Number),
        query: expect.stringMatching(/^select\.projection_revisions\.[0-9a-f]{12}$/),
        rowCount: 1,
        statement: 'select',
        table: 'projection_revisions',
        trigger: 'page',
      }),
    ]);
    expect(JSON.stringify(observations)).not.toContain('large-private-payload');
    expect(JSON.stringify(observations)).not.toContain('projection:1');
  });

  it('defaults on only in production and honors explicit switches', () => {
    expect(shouldObserveAtlasPostgresQueries({ NODE_ENV: 'production' })).toBe(true);
    expect(shouldObserveAtlasPostgresQueries({ NODE_ENV: 'test' })).toBe(false);
    expect(
      shouldObserveAtlasPostgresQueries({
        ATLAS_POSTGRES_DIAGNOSTICS: 'off',
        NODE_ENV: 'production',
      }),
    ).toBe(false);
    expect(
      shouldObserveAtlasPostgresQueries({
        ATLAS_POSTGRES_DIAGNOSTICS: 'on',
        NODE_ENV: 'test',
      }),
    ).toBe(true);
  });
});
