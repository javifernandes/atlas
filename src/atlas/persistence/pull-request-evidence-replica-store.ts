import type { Pool } from 'pg';

import type {
  AtlasGitHubEvidenceSource,
  AtlasObservedPullRequest,
  AtlasPullRequestEvidenceReplicaStore,
} from '../github/pull-request-evidence';

type FrontierRow = {
  provider_updated_at: Date | string;
};

type EvidenceRow = {
  payload_json: AtlasObservedPullRequest | string;
};

const parsePayload = (value: AtlasObservedPullRequest | string) =>
  typeof value === 'string'
    ? (JSON.parse(value) as AtlasObservedPullRequest)
    : value;

export const createAtlasPullRequestEvidenceReplicaStore = (
  pool: Pick<Pool, 'connect'>,
): AtlasPullRequestEvidenceReplicaStore => ({
  load: async (source: AtlasGitHubEvidenceSource) => {
    const client = await pool.connect();

    try {
      await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const frontierResult = await client.query<FrontierRow>(
        `SELECT provider_updated_at
           FROM atlas_github_evidence_frontiers
          WHERE lower(repository_full_name) = lower($1)`,
        [source.repositoryFullName],
      );
      const evidenceResult = await client.query<EvidenceRow>(
        `SELECT payload_json
           FROM atlas_github_pull_request_evidence_replica
          WHERE lower(repository_full_name) = lower($1)
          ORDER BY number`,
        [source.repositoryFullName],
      );
      await client.query('COMMIT');

      return {
        frontier: frontierResult.rows[0]?.provider_updated_at
          ? new Date(frontierResult.rows[0].provider_updated_at).toISOString()
          : null,
        pullRequests: evidenceResult.rows.map(row => parsePayload(row.payload_json)),
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  save: async ({ changes, frontier, source }) => {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      for (const change of changes) {
        if (!change.pullRequest) {
          await client.query(
            `DELETE FROM atlas_github_pull_request_evidence_replica
              WHERE id = $1
                AND provider_updated_at <= $2`,
            [change.id, change.updatedAt],
          );
          continue;
        }

        await client.query(
          `INSERT INTO atlas_github_pull_request_evidence_replica
             (id, repository_full_name, number, source_id, provider_updated_at, payload_json,
              observed_at)
           VALUES ($1, $2, $3, $4, $5, $6::jsonb, now())
           ON CONFLICT (id) DO UPDATE SET
             repository_full_name = EXCLUDED.repository_full_name,
             number = EXCLUDED.number,
             source_id = EXCLUDED.source_id,
             provider_updated_at = EXCLUDED.provider_updated_at,
             payload_json = EXCLUDED.payload_json,
             observed_at = EXCLUDED.observed_at
           WHERE atlas_github_pull_request_evidence_replica.provider_updated_at
                 <= EXCLUDED.provider_updated_at`,
          [
            change.id,
            source.repositoryFullName,
            change.pullRequest.number,
            source.sourceId,
            change.updatedAt,
            JSON.stringify(change.pullRequest),
          ],
        );
      }

      await client.query(
        `INSERT INTO atlas_github_evidence_frontiers
           (repository_full_name, source_id, provider_updated_at, observed_at)
         VALUES ($1, $2, $3, now())
         ON CONFLICT (repository_full_name) DO UPDATE SET
           source_id = EXCLUDED.source_id,
           provider_updated_at = GREATEST(
             atlas_github_evidence_frontiers.provider_updated_at,
             EXCLUDED.provider_updated_at
           ),
           observed_at = EXCLUDED.observed_at`,
        [source.repositoryFullName, source.sourceId, frontier],
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },
});
