import type {
  MaterializerDependency,
  ReplicatedVersionedModelSnapshot,
} from '@ontahi/core';
import type { Pool, PoolClient } from 'pg';

import type { PortableParsedAtlasSourceRecordArtifact } from '../markdown/parsed-record-artifact';
import type { AtlasParsedRecordMaterializerState } from '../markdown/parsed-record-materializer';

export type AtlasParsedRecordMaterializationCheckpoint = {
  artifacts: readonly PortableParsedAtlasSourceRecordArtifact[];
  dependencies: readonly MaterializerDependency[];
  scopeId: string;
  snapshot: ReplicatedVersionedModelSnapshot<AtlasParsedRecordMaterializerState>;
  updatedAt: string;
};

export type AtlasMaterializationCheckpointWriteResult =
  | { status: 'stored' }
  | { currentSourceFrontier: string | null; status: 'conflict' };

type MaterializationCheckpointRow = {
  accepted_frontier: string;
  derivation_id: string;
  materializer_version: string;
  source_frontier: string;
  state_json: string;
  updated_at: Date | string;
};

type MaterializationArtifactRow = {
  artifact_id: string;
  content_hash: string;
  derivation_id: string;
  materializer_version: string;
  payload_json: string;
  source_path: string;
  source_record_identity: string;
};

type MaterializationDependencyRow = {
  input_identity: string;
  outputs_json: string;
};

const rollback = async (client: Pick<PoolClient, 'query'>) => {
  await client.query('ROLLBACK');
};

const parseOutputs = (row: MaterializationDependencyRow) => {
  const outputs = JSON.parse(row.outputs_json) as unknown;

  if (!Array.isArray(outputs) || outputs.some(output => typeof output !== 'string')) {
    throw new Error(`Invalid dependency outputs for ${row.input_identity}.`);
  }

  return outputs;
};

export const createAtlasParsedRecordMaterializationStore = (pool: Pick<Pool, 'connect'>) => ({
  async load(input: {
    derivationId: string;
    scopeId: string;
  }): Promise<AtlasParsedRecordMaterializationCheckpoint | null> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const checkpointResult = await client.query<MaterializationCheckpointRow>(
        `SELECT derivation_id, materializer_version, source_frontier, accepted_frontier,
                state_json, updated_at
           FROM atlas_materialization_checkpoints
          WHERE scope_id = $1 AND derivation_id = $2`,
        [input.scopeId, input.derivationId],
      );
      const checkpoint = checkpointResult.rows[0];

      if (!checkpoint) {
        await client.query('COMMIT');
        return null;
      }

      const [artifactResult, dependencyResult] = await Promise.all([
        client.query<MaterializationArtifactRow>(
          `SELECT derivation_id, artifact_id, source_record_identity, source_path, content_hash,
                  materializer_version, payload_json
             FROM atlas_materialization_artifacts
            WHERE scope_id = $1 AND derivation_id = $2
            ORDER BY source_record_identity`,
          [input.scopeId, input.derivationId],
        ),
        client.query<MaterializationDependencyRow>(
          `SELECT input_identity, outputs_json
             FROM atlas_materialization_dependencies
            WHERE scope_id = $1 AND derivation_id = $2
            ORDER BY input_identity`,
          [input.scopeId, input.derivationId],
        ),
      ]);
      await client.query('COMMIT');

      return {
        artifacts: artifactResult.rows.map(row => ({
          artifactId: row.artifact_id,
          contentHash: row.content_hash,
          materializerId: row.derivation_id,
          materializerVersion: row.materializer_version,
          payloadJson: row.payload_json,
          sourcePath: row.source_path,
          sourceRecordIdentity: row.source_record_identity,
        })) as PortableParsedAtlasSourceRecordArtifact[],
        dependencies: dependencyResult.rows.map(row => ({
          input: row.input_identity,
          outputs: parseOutputs(row),
        })),
        scopeId: input.scopeId,
        snapshot: {
          acceptance: {
            acceptedFrontier: checkpoint.accepted_frontier,
            derivationId: checkpoint.derivation_id,
            materializerVersion: checkpoint.materializer_version,
            sourceFrontier: checkpoint.source_frontier,
          },
          state: JSON.parse(checkpoint.state_json) as AtlasParsedRecordMaterializerState,
        },
        updatedAt:
          checkpoint.updated_at instanceof Date
            ? checkpoint.updated_at.toISOString()
            : checkpoint.updated_at,
      };
    } catch (error) {
      await rollback(client);
      throw error;
    } finally {
      client.release();
    }
  },

  async replace(input: {
    checkpoint: AtlasParsedRecordMaterializationCheckpoint;
    expectedSourceFrontier: string | null;
  }): Promise<AtlasMaterializationCheckpointWriteResult> {
    const { checkpoint } = input;
    const { acceptance } = checkpoint.snapshot;
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      const currentResult = await client.query<{ source_frontier: string }>(
        `SELECT source_frontier
           FROM atlas_materialization_checkpoints
          WHERE scope_id = $1 AND derivation_id = $2
          FOR UPDATE`,
        [checkpoint.scopeId, acceptance.derivationId],
      );
      const currentSourceFrontier = currentResult.rows[0]?.source_frontier ?? null;

      if (currentSourceFrontier !== input.expectedSourceFrontier) {
        await rollback(client);
        return {
          currentSourceFrontier,
          status: 'conflict',
        };
      }

      await client.query(
        `INSERT INTO atlas_materialization_checkpoints
           (scope_id, derivation_id, materializer_version, source_frontier, accepted_frontier,
            state_json, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (scope_id, derivation_id) DO UPDATE SET
           materializer_version = EXCLUDED.materializer_version,
           source_frontier = EXCLUDED.source_frontier,
           accepted_frontier = EXCLUDED.accepted_frontier,
           state_json = EXCLUDED.state_json,
           updated_at = EXCLUDED.updated_at`,
        [
          checkpoint.scopeId,
          acceptance.derivationId,
          acceptance.materializerVersion,
          acceptance.sourceFrontier,
          acceptance.acceptedFrontier,
          JSON.stringify(checkpoint.snapshot.state),
          checkpoint.updatedAt,
        ],
      );
      await client.query(
        `DELETE FROM atlas_materialization_artifacts
          WHERE scope_id = $1 AND derivation_id = $2`,
        [checkpoint.scopeId, acceptance.derivationId],
      );
      await client.query(
        `DELETE FROM atlas_materialization_dependencies
          WHERE scope_id = $1 AND derivation_id = $2`,
        [checkpoint.scopeId, acceptance.derivationId],
      );

      if (checkpoint.artifacts.length > 0) {
        await client.query(
          `INSERT INTO atlas_materialization_artifacts
             (scope_id, derivation_id, artifact_id, source_record_identity, source_path,
              content_hash, materializer_version, payload_json)
           SELECT $1, $2, artifact_id, source_record_identity, source_path, content_hash,
                  materializer_version, payload_json
             FROM unnest($3::text[], $4::text[], $5::text[], $6::text[], $7::text[], $8::text[])
               AS artifact(artifact_id, source_record_identity, source_path, content_hash,
                           materializer_version, payload_json)`,
          [
            checkpoint.scopeId,
            acceptance.derivationId,
            checkpoint.artifacts.map(artifact => artifact.artifactId),
            checkpoint.artifacts.map(artifact => artifact.sourceRecordIdentity),
            checkpoint.artifacts.map(artifact => artifact.sourcePath),
            checkpoint.artifacts.map(artifact => artifact.contentHash),
            checkpoint.artifacts.map(artifact => artifact.materializerVersion),
            checkpoint.artifacts.map(artifact => artifact.payloadJson),
          ],
        );
      }

      if (checkpoint.dependencies.length > 0) {
        await client.query(
          `INSERT INTO atlas_materialization_dependencies
             (scope_id, derivation_id, input_identity, outputs_json)
           SELECT $1, $2, input_identity, outputs_json
             FROM unnest($3::text[], $4::text[])
               AS dependency(input_identity, outputs_json)`,
          [
            checkpoint.scopeId,
            acceptance.derivationId,
            checkpoint.dependencies.map(dependency => dependency.input),
            checkpoint.dependencies.map(dependency => JSON.stringify(dependency.outputs)),
          ],
        );
      }

      await client.query('COMMIT');
      return { status: 'stored' };
    } catch (error) {
      await rollback(client);
      throw error;
    } finally {
      client.release();
    }
  },
});
