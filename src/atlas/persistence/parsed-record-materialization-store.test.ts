import type { Pool } from 'pg';
import { describe, expect, it, vi } from 'vitest';

import {
  ATLAS_PARSED_RECORD_MATERIALIZER_ID,
  ATLAS_PARSED_RECORD_MATERIALIZER_VERSION,
  type PortableParsedAtlasSourceRecordArtifact,
} from '../markdown/parsed-record-artifact';
import {
  createAtlasParsedRecordMaterializationStore,
  type AtlasParsedRecordMaterializationCheckpoint,
} from './parsed-record-materialization-store';

const artifact: PortableParsedAtlasSourceRecordArtifact = {
  artifactId: 'atlas://atlas/one@sha256:content#1',
  contentHash: 'content',
  materializerId: ATLAS_PARSED_RECORD_MATERIALIZER_ID,
  materializerVersion: ATLAS_PARSED_RECORD_MATERIALIZER_VERSION,
  payloadJson: '{"item":null,"plan":null,"relocationTarget":null}',
  sourcePath: 'atlas/items/one.md',
  sourceRecordIdentity: 'atlas://atlas/one',
};

const checkpoint: AtlasParsedRecordMaterializationCheckpoint = {
  artifacts: [artifact],
  dependencies: [{ input: artifact.sourcePath, outputs: [artifact.sourceRecordIdentity] }],
  scopeId: 'projection:atlas',
  snapshot: {
    acceptance: {
      acceptedFrontier: 'artifacts:target',
      derivationId: ATLAS_PARSED_RECORD_MATERIALIZER_ID,
      materializerVersion: ATLAS_PARSED_RECORD_MATERIALIZER_VERSION,
      sourceFrontier: 'git:target',
    },
    state: { artifactIds: [artifact.artifactId] },
  },
  updatedAt: '2026-11-21T00:00:00.000Z',
};

const fakePool = (query: ReturnType<typeof vi.fn>) => {
  const release = vi.fn();

  return {
    pool: {
      connect: vi.fn(async () => ({ query, release })),
    } as unknown as Pick<Pool, 'connect'>,
    release,
  };
};

describe('Atlas parsed-record materialization store', () => {
  it('atomically replaces the checkpoint, artifacts, and dependency evidence', async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('SELECT source_frontier')) return { rows: [] };
      return { rows: [] };
    });
    const { pool, release } = fakePool(query);
    const store = createAtlasParsedRecordMaterializationStore(pool);

    await expect(
      store.replace({ checkpoint, expectedSourceFrontier: null }),
    ).resolves.toEqual({ status: 'stored' });

    expect(query.mock.calls.map(([sql]) => sql.trim().split(/\s+/).slice(0, 3).join(' '))).toEqual([
      'BEGIN',
      'SELECT source_frontier FROM',
      'INSERT INTO atlas_materialization_checkpoints',
      'DELETE FROM atlas_materialization_artifacts',
      'DELETE FROM atlas_materialization_dependencies',
      'INSERT INTO atlas_materialization_artifacts',
      'INSERT INTO atlas_materialization_dependencies',
      'COMMIT',
    ]);
    expect(release).toHaveBeenCalledOnce();
  });

  it('rejects a stale writer before replacing accepted state', async () => {
    const query = vi.fn(async (sql: string) =>
      sql.includes('SELECT source_frontier')
        ? { rows: [{ source_frontier: 'git:newer' }] }
        : { rows: [] },
    );
    const { pool } = fakePool(query);
    const store = createAtlasParsedRecordMaterializationStore(pool);

    await expect(
      store.replace({ checkpoint, expectedSourceFrontier: 'git:base' }),
    ).resolves.toEqual({ currentSourceFrontier: 'git:newer', status: 'conflict' });
    expect(query.mock.calls.map(([sql]) => sql.trim())).toEqual([
      'BEGIN',
      expect.stringContaining('SELECT source_frontier'),
      'ROLLBACK',
    ]);
  });

  it('rejects a concurrent first insert before replacing artifacts', async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('FOR UPDATE')) return { rows: [] };
      if (sql.includes('INSERT INTO atlas_materialization_checkpoints')) {
        expect(sql).toContain('WHERE atlas_materialization_checkpoints.source_frontier = $8');
        return { rowCount: 0, rows: [] };
      }
      if (sql.includes('SELECT source_frontier')) {
        return { rows: [{ source_frontier: 'git:winner' }] };
      }
      return { rows: [] };
    });
    const { pool } = fakePool(query);
    const store = createAtlasParsedRecordMaterializationStore(pool);

    await expect(
      store.replace({ checkpoint, expectedSourceFrontier: null }),
    ).resolves.toEqual({ currentSourceFrontier: 'git:winner', status: 'conflict' });
    expect(query.mock.calls.some(([sql]) => sql.includes('DELETE FROM'))).toBe(false);
  });

  it('hydrates one repeatable-read snapshot including empty-output dependencies', async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('FROM atlas_materialization_checkpoints')) {
        return {
          rows: [
            {
              accepted_frontier: 'artifacts:target',
              derivation_id: ATLAS_PARSED_RECORD_MATERIALIZER_ID,
              materializer_version: ATLAS_PARSED_RECORD_MATERIALIZER_VERSION,
              source_frontier: 'git:target',
              state_json: JSON.stringify(checkpoint.snapshot.state),
              updated_at: new Date(checkpoint.updatedAt),
            },
          ],
        };
      }
      if (sql.includes('FROM atlas_materialization_artifacts')) {
        return {
          rows: [
            {
              artifact_id: artifact.artifactId,
              content_hash: artifact.contentHash,
              derivation_id: artifact.materializerId,
              materializer_version: artifact.materializerVersion,
              payload_json: artifact.payloadJson,
              source_path: artifact.sourcePath,
              source_record_identity: artifact.sourceRecordIdentity,
            },
          ],
        };
      }
      if (sql.includes('FROM atlas_materialization_dependencies')) {
        return { rows: [{ input_identity: 'removed.md', outputs_json: '[]' }] };
      }
      return { rows: [] };
    });
    const { pool } = fakePool(query);
    const store = createAtlasParsedRecordMaterializationStore(pool);

    await expect(
      store.load({
        derivationId: ATLAS_PARSED_RECORD_MATERIALIZER_ID,
        scopeId: checkpoint.scopeId,
      }),
    ).resolves.toEqual({
      ...checkpoint,
      dependencies: [{ input: 'removed.md', outputs: [] }],
    });
    expect(query).toHaveBeenCalledWith(
      'BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY',
    );
  });
});
