CREATE TABLE atlas_workspace_source_imports (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES atlas_workspaces(id) ON DELETE CASCADE,
  trigger_source_id uuid REFERENCES atlas_workspace_sources(id) ON DELETE SET NULL,
  trigger text NOT NULL CHECK (trigger IN ('connection', 'manual', 'push', 'pull-request')),
  repository text,
  observed_revision text,
  source_revisions_json text NOT NULL DEFAULT '[]',
  status text NOT NULL CHECK (
    status IN (
      'pending',
      'running',
      'completed',
      'failed',
      'cancel-requested',
      'compensating',
      'cancelled'
    )
  ),
  started_at timestamptz NOT NULL,
  completed_at timestamptz,
  error text,
  diagnostics_json text NOT NULL DEFAULT '{}'
);

CREATE INDEX atlas_workspace_source_imports_workspace_started_idx
  ON atlas_workspace_source_imports (workspace_id, started_at DESC, id DESC);

CREATE TABLE atlas_workspace_projection_revisions (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES atlas_workspaces(id) ON DELETE CASCADE,
  import_id uuid NOT NULL UNIQUE
    REFERENCES atlas_workspace_source_imports(id) ON DELETE CASCADE,
  source_revision_set_hash text NOT NULL,
  snapshot_json text NOT NULL,
  started_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL
);

CREATE INDEX atlas_workspace_projection_revisions_workspace_created_idx
  ON atlas_workspace_projection_revisions (workspace_id, started_at DESC, id DESC);
