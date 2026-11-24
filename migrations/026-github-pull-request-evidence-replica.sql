CREATE TABLE atlas_github_evidence_frontiers (
  repository_full_name text PRIMARY KEY,
  source_id text NOT NULL,
  provider_updated_at timestamptz NOT NULL,
  observed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE atlas_github_pull_request_evidence_replica (
  id text PRIMARY KEY,
  repository_full_name text NOT NULL,
  number integer NOT NULL,
  source_id text NOT NULL,
  provider_updated_at timestamptz NOT NULL,
  payload_json jsonb NOT NULL,
  observed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (repository_full_name, number)
);

CREATE INDEX atlas_github_pull_request_evidence_replica_repository_idx
  ON atlas_github_pull_request_evidence_replica (repository_full_name);
