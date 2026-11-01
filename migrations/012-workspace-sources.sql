CREATE TABLE atlas_workspace_sources (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES atlas_workspaces(id) ON DELETE CASCADE,
  source_id text NOT NULL,
  provider text NOT NULL CHECK (provider IN ('github', 'local')),
  repository text,
  ref text NOT NULL,
  status text NOT NULL CHECK (status IN ('active', 'paused')),
  contributor_access text NOT NULL
    CHECK (contributor_access IN ('off', 'approval-required', 'automatic-viewer')),
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (workspace_id, source_id),
  UNIQUE (workspace_id, provider, repository)
);

CREATE INDEX atlas_workspace_sources_workspace_active_idx
  ON atlas_workspace_sources (workspace_id, source_id)
  WHERE status = 'active';

INSERT INTO atlas_workspace_sources (
  workspace_id,
  source_id,
  provider,
  repository,
  ref,
  status,
  contributor_access
)
VALUES
  (
    '00000000-0000-4000-8000-000000000137',
    'atlas',
    'github',
    'javifernandes/atlas',
    'main',
    'active',
    'approval-required'
  ),
  (
    '00000000-0000-4000-8000-000000000137',
    'bookops',
    'github',
    'javifernandes/bookops',
    'main',
    'active',
    'approval-required'
  ),
  (
    '00000000-0000-4000-8000-000000000137',
    'ontahi',
    'github',
    'javifernandes/ontahi',
    'main',
    'active',
    'approval-required'
  )
ON CONFLICT (workspace_id, source_id) DO NOTHING;
