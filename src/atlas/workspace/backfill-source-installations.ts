import { randomUUID } from 'node:crypto';

import type { Pool, PoolClient } from 'pg';

import { getAtlasGitHubRepositoryInstallationId } from '../github/installation-client';
import type { AtlasWorkspaceSourceReconciliationResult } from './workspace-source-reconciliation';
import { DEFAULT_ATLAS_WORKSPACE_ID } from './workspace-access';

type InstallationSource = {
  id: string;
  repository: string;
};

type ProjectionSource = InstallationSource & {
  ref: string;
  sourceId: string;
};

export const backfillAtlasWorkspaceSourceInstallations = async (input: {
  pool: Pick<Pool, 'query'>;
  resolveInstallationId?: (repository: string) => Promise<string | null>;
}) => {
  const result = await input.pool.query<InstallationSource>(`
    SELECT id, repository
    FROM atlas_workspace_sources
    WHERE provider = 'github'
      AND status = 'active'
      AND provider_installation_id IS NULL
      AND repository IS NOT NULL
    ORDER BY workspace_id, source_id
  `);
  const resolveInstallationId = input.resolveInstallationId ?? (repository =>
    getAtlasGitHubRepositoryInstallationId({ repositoryFullName: repository }));
  let updated = 0;

  for (const source of result.rows) {
    const installationId = await resolveInstallationId(source.repository);
    if (!installationId) {
      throw new Error(
        `Atlas GitHub App is not installed for Workspace Source ${source.repository}.`,
      );
    }
    await input.pool.query(
      `UPDATE atlas_workspace_sources
       SET provider_installation_id = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND provider_installation_id IS NULL`,
      [installationId, source.id],
    );
    updated += 1;
  }

  return { inspected: result.rows.length, updated };
};

export const backfillCanonicalAtlasWorkspaceOwner = async (input: {
  pool: Pick<Pool, 'query'>;
}) => {
  const result = await input.pool.query(
    `INSERT INTO atlas_workspace_memberships (workspace_id, user_id, role, status)
     SELECT $1, users.id, 'owner', 'active'
     FROM atlas_auth_users AS users
     ORDER BY users.created_at ASC, users.id ASC
     LIMIT 1
     ON CONFLICT (workspace_id, user_id) DO UPDATE
     SET role = 'owner', status = 'active', updated_at = CURRENT_TIMESTAMP
     RETURNING user_id`,
    [DEFAULT_ATLAS_WORKSPACE_ID],
  );
  return { ownerAssigned: result.rowCount === 1 };
};

export const backfillCanonicalAtlasWorkspaceProjection = async (input: {
  pool: Pick<Pool, 'connect' | 'query'>;
  reconcile: (input: {
    workspaceId: string;
    sources: Array<{ id: string; repository: string; ref: string }>;
  }) => Promise<AtlasWorkspaceSourceReconciliationResult>;
}) => {
  const existing = await input.pool.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM atlas_workspace_projection_revisions WHERE workspace_id = $1
     ) AS exists`,
    [DEFAULT_ATLAS_WORKSPACE_ID],
  );
  if (existing.rows[0]?.exists) return { created: false, sourceCount: 0 };

  const sourceResult = await input.pool.query<ProjectionSource>(
    `SELECT id, source_id AS "sourceId", repository, ref
     FROM atlas_workspace_sources
     WHERE workspace_id = $1
       AND provider = 'github'
       AND status = 'active'
       AND provider_installation_id IS NOT NULL
       AND repository IS NOT NULL
     ORDER BY source_id`,
    [DEFAULT_ATLAS_WORKSPACE_ID],
  );
  if (sourceResult.rows.length === 0) {
    throw new Error('The canonical Atlas Workspace has no authorized active Sources.');
  }

  const startedAt = new Date().toISOString();
  const result = await input.reconcile({
    workspaceId: DEFAULT_ATLAS_WORKSPACE_ID,
    sources: sourceResult.rows.map(source => ({
      id: source.sourceId,
      repository: source.repository,
      ref: source.ref,
    })),
  });
  const completedAt = new Date().toISOString();
  const importId = randomUUID();
  const projectionId = randomUUID();
  const client: PoolClient = await input.pool.connect();

  try {
    await client.query('BEGIN');
    const stillMissing = await client.query<{ missing: boolean }>(
      `SELECT NOT EXISTS (
         SELECT 1 FROM atlas_workspace_projection_revisions WHERE workspace_id = $1
       ) AS missing`,
      [DEFAULT_ATLAS_WORKSPACE_ID],
    );
    if (!stillMissing.rows[0]?.missing) {
      await client.query('ROLLBACK');
      return { created: false, sourceCount: 0 };
    }
    await client.query(
      `INSERT INTO atlas_workspace_source_imports (
         id, workspace_id, trigger_source_id, trigger, repository, observed_revision,
         source_revisions_json, status, started_at, completed_at, diagnostics_json,
         provider_delivery_id, trigger_revision, pull_request_number
       ) VALUES ($1, $2, NULL, 'manual', NULL, NULL, $3, 'completed', $4, $5, $6, NULL, NULL, NULL)`,
      [
        importId,
        DEFAULT_ATLAS_WORKSPACE_ID,
        JSON.stringify(result.sourceRevisions),
        startedAt,
        completedAt,
        JSON.stringify({ migration: 'canonical-workspace-partition' }),
      ],
    );
    await client.query(
      `INSERT INTO atlas_workspace_projection_revisions (
         id, workspace_id, import_id, source_revision_set_hash, snapshot_json,
         started_at, created_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        projectionId,
        DEFAULT_ATLAS_WORKSPACE_ID,
        importId,
        result.sourceRevisionSetHash,
        JSON.stringify(result.snapshot),
        startedAt,
        completedAt,
      ],
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  return { created: true, sourceCount: sourceResult.rows.length };
};
