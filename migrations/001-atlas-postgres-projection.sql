CREATE TABLE atlas_source_revisions (
  id text PRIMARY KEY,
  source_id text NOT NULL,
  repository text,
  authority text NOT NULL CHECK (authority IN ('markdown', 'github')),
  revision text NOT NULL,
  revision_kind text NOT NULL CHECK (revision_kind IN ('git', 'content-sha256')),
  observed_at timestamptz NOT NULL,
  UNIQUE (source_id, authority, revision)
);

CREATE INDEX atlas_source_revisions_source_observed_idx
  ON atlas_source_revisions (source_id, observed_at DESC);

CREATE TABLE atlas_source_records (
  id text PRIMARY KEY,
  canonical_path text NOT NULL UNIQUE,
  source_id text NOT NULL,
  source_revision_id text NOT NULL REFERENCES atlas_source_revisions(id),
  source_path text NOT NULL,
  source_file_path text,
  record_kind text NOT NULL CHECK (record_kind IN ('item', 'plan', 'other')),
  content text NOT NULL,
  content_hash text NOT NULL,
  UNIQUE (source_id, source_path)
);

CREATE INDEX atlas_source_records_source_idx ON atlas_source_records (source_id);

CREATE TABLE atlas_items (
  id text PRIMARY KEY,
  semantic_id text NOT NULL UNIQUE,
  title text NOT NULL,
  kind text NOT NULL,
  status text NOT NULL,
  parent_id text REFERENCES atlas_items(id) ON DELETE SET NULL,
  source_id text NOT NULL,
  source_revision_id text NOT NULL REFERENCES atlas_source_revisions(id),
  source_record_id text NOT NULL REFERENCES atlas_source_records(id) ON DELETE CASCADE
);

CREATE INDEX atlas_items_source_idx ON atlas_items (source_id);
CREATE INDEX atlas_items_parent_idx ON atlas_items (parent_id);

CREATE TABLE atlas_plans (
  id text PRIMARY KEY,
  path text NOT NULL UNIQUE,
  title text NOT NULL,
  status text NOT NULL,
  parent_plan_id text REFERENCES atlas_plans(id) ON DELETE SET NULL,
  source_id text NOT NULL,
  source_revision_id text NOT NULL REFERENCES atlas_source_revisions(id),
  source_record_id text NOT NULL REFERENCES atlas_source_records(id) ON DELETE CASCADE
);

CREATE INDEX atlas_plans_source_idx ON atlas_plans (source_id);
CREATE INDEX atlas_plans_parent_idx ON atlas_plans (parent_plan_id);

CREATE TABLE atlas_shaping_bindings (
  id text PRIMARY KEY,
  item_id text NOT NULL REFERENCES atlas_items(id) ON DELETE CASCADE,
  plan_id text NOT NULL REFERENCES atlas_plans(id) ON DELETE CASCADE,
  source_id text NOT NULL,
  source_revision_id text NOT NULL REFERENCES atlas_source_revisions(id),
  source_record_id text NOT NULL REFERENCES atlas_source_records(id) ON DELETE CASCADE
);

CREATE INDEX atlas_shaping_bindings_source_idx ON atlas_shaping_bindings (source_id);
CREATE INDEX atlas_shaping_bindings_item_idx ON atlas_shaping_bindings (item_id);
CREATE INDEX atlas_shaping_bindings_plan_idx ON atlas_shaping_bindings (plan_id);

CREATE TABLE atlas_support_bindings (
  id text PRIMARY KEY,
  source_item_id text NOT NULL REFERENCES atlas_items(id) ON DELETE CASCADE,
  target_item_id text NOT NULL REFERENCES atlas_items(id) ON DELETE CASCADE,
  source_id text NOT NULL,
  source_revision_id text NOT NULL REFERENCES atlas_source_revisions(id),
  source_record_id text NOT NULL REFERENCES atlas_source_records(id) ON DELETE CASCADE
);

CREATE INDEX atlas_support_bindings_source_idx ON atlas_support_bindings (source_id);
CREATE INDEX atlas_support_bindings_source_item_idx ON atlas_support_bindings (source_item_id);
CREATE INDEX atlas_support_bindings_target_item_idx ON atlas_support_bindings (target_item_id);

CREATE TABLE atlas_plan_relation_bindings (
  id text PRIMARY KEY,
  source_plan_id text NOT NULL REFERENCES atlas_plans(id) ON DELETE CASCADE,
  target_plan_id text NOT NULL REFERENCES atlas_plans(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('follow-up', 'related')),
  source_id text NOT NULL,
  source_revision_id text NOT NULL REFERENCES atlas_source_revisions(id),
  source_record_id text NOT NULL REFERENCES atlas_source_records(id) ON DELETE CASCADE
);

CREATE INDEX atlas_plan_relation_bindings_source_idx
  ON atlas_plan_relation_bindings (source_id);
CREATE INDEX atlas_plan_relation_bindings_source_plan_idx
  ON atlas_plan_relation_bindings (source_plan_id);
CREATE INDEX atlas_plan_relation_bindings_target_plan_idx
  ON atlas_plan_relation_bindings (target_plan_id);

CREATE TABLE pull_requests (
  id text PRIMARY KEY,
  author_avatar_url text,
  author_login text,
  merge_commit_sha text,
  merged_by_avatar_url text,
  merged_by_login text,
  merged_at timestamptz NOT NULL,
  number integer NOT NULL,
  repository_full_name text NOT NULL,
  source_id text NOT NULL,
  source_authority text NOT NULL CHECK (source_authority = 'github'),
  source_revision text NOT NULL,
  observed_at timestamptz NOT NULL,
  title text NOT NULL,
  url text NOT NULL,
  UNIQUE (repository_full_name, number)
);

CREATE INDEX pull_requests_source_idx ON pull_requests (source_id);

CREATE TABLE evidence_bindings (
  id text PRIMARY KEY,
  pull_request_id text NOT NULL REFERENCES pull_requests(id) ON DELETE CASCADE,
  item_id text REFERENCES atlas_items(id) ON DELETE CASCADE,
  plan_id text REFERENCES atlas_plans(id) ON DELETE CASCADE,
  target_node_id text NOT NULL,
  target_kind text NOT NULL CHECK (target_kind IN ('item', 'plan')),
  kind text NOT NULL CHECK (kind IN ('implements', 'shapes')),
  provenance text NOT NULL CHECK (provenance = 'explicit'),
  source_id text NOT NULL,
  source_authority text NOT NULL CHECK (source_authority = 'github'),
  source_revision text NOT NULL,
  CHECK ((item_id IS NOT NULL)::integer + (plan_id IS NOT NULL)::integer = 1)
);

CREATE INDEX evidence_bindings_pull_request_idx ON evidence_bindings (pull_request_id);
CREATE INDEX evidence_bindings_target_idx ON evidence_bindings (target_node_id);
CREATE INDEX evidence_bindings_source_idx ON evidence_bindings (source_id);

CREATE TABLE projection_revisions (
  id text PRIMARY KEY,
  trigger text NOT NULL CHECK (trigger IN ('bootstrap', 'manual', 'rebuild', 'webhook')),
  source_revision_set_hash text NOT NULL,
  snapshot_json text NOT NULL,
  started_at timestamptz NOT NULL,
  completed_at timestamptz NOT NULL,
  status text NOT NULL CHECK (status = 'completed')
);

CREATE INDEX projection_revisions_completed_idx
  ON projection_revisions (completed_at DESC, id DESC);

CREATE TABLE projection_source_revisions (
  id text PRIMARY KEY,
  projection_revision_id text NOT NULL REFERENCES projection_revisions(id) ON DELETE CASCADE,
  source_revision_id text NOT NULL REFERENCES atlas_source_revisions(id),
  source_id text NOT NULL,
  UNIQUE (projection_revision_id, source_revision_id)
);

CREATE INDEX projection_source_revisions_projection_idx
  ON projection_source_revisions (projection_revision_id);

CREATE TABLE webhook_deliveries (
  id text PRIMARY KEY,
  provider text NOT NULL CHECK (provider = 'github'),
  event text NOT NULL,
  source_id text,
  source_revision text,
  repository_full_name text NOT NULL,
  processing_token text NOT NULL,
  received_at timestamptz NOT NULL,
  processed_at timestamptz,
  projection_revision_id text REFERENCES projection_revisions(id)
);

CREATE INDEX webhook_deliveries_repository_idx
  ON webhook_deliveries (repository_full_name, received_at DESC);
