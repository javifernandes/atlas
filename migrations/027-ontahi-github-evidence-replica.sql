CREATE TABLE IF NOT EXISTS ontahi_replicated_collections (
  collection_id text PRIMARY KEY,
  revision bigint NOT NULL,
  snapshot jsonb NOT NULL
);

INSERT INTO ontahi_replicated_collections (collection_id, revision, snapshot)
SELECT
  'atlas:github-evidence:' || lower(frontier.repository_full_name),
  1,
  jsonb_build_object(
    'frontier', to_char(frontier.provider_updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'records', COALESCE(records.snapshot, '[]'::jsonb)
  )
FROM (
  SELECT DISTINCT ON (lower(repository_full_name)) repository_full_name, provider_updated_at
  FROM atlas_github_evidence_frontiers
  ORDER BY lower(repository_full_name), provider_updated_at DESC, repository_full_name
) AS frontier
LEFT JOIN LATERAL (
  SELECT jsonb_agg(jsonb_build_object('id', replica.id, 'record', replica.payload_json)
                  ORDER BY replica.id) AS snapshot
  FROM atlas_github_pull_request_evidence_replica AS replica
  WHERE lower(replica.repository_full_name) = lower(frontier.repository_full_name)
) AS records ON true
ON CONFLICT (collection_id) DO NOTHING;
