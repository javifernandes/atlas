CREATE TABLE atlas_source_change_sets (
  id text PRIMARY KEY,
  source_id text NOT NULL,
  base_source_revision_id text NOT NULL REFERENCES atlas_source_revisions(id),
  target_source_revision_id text NOT NULL REFERENCES atlas_source_revisions(id),
  operation_count integer NOT NULL CHECK (operation_count >= 0),
  operations_json text NOT NULL,
  provenance_json text NOT NULL,
  provider text NOT NULL CHECK (provider = 'github'),
  provider_delivery_id text,
  unit_of_work_id text,
  session_id text,
  principal_id text,
  observed_at timestamptz NOT NULL,
  UNIQUE (target_source_revision_id)
);

CREATE UNIQUE INDEX atlas_source_change_sets_provider_delivery_idx
  ON atlas_source_change_sets (provider, provider_delivery_id)
  WHERE provider_delivery_id IS NOT NULL;

CREATE INDEX atlas_source_change_sets_source_observed_idx
  ON atlas_source_change_sets (source_id, observed_at DESC);

CREATE TABLE atlas_source_change_set_applications (
  id text PRIMARY KEY,
  change_set_id text NOT NULL REFERENCES atlas_source_change_sets(id),
  projection_revision_id text NOT NULL REFERENCES projection_revisions(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('applied', 'duplicate')),
  applied_at timestamptz NOT NULL,
  diagnostics_json text NOT NULL,
  UNIQUE (change_set_id)
);

CREATE INDEX atlas_source_change_set_applications_projection_idx
  ON atlas_source_change_set_applications (projection_revision_id);
