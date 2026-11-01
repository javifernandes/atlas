CREATE TABLE atlas_workspace_contributors (
  id text PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES atlas_workspaces(id) ON DELETE CASCADE,
  workspace_source_id uuid NOT NULL REFERENCES atlas_workspace_sources(id) ON DELETE CASCADE,
  source_id text NOT NULL,
  provider text NOT NULL CHECK (provider = 'github'),
  provider_account_id text NOT NULL,
  login text NOT NULL,
  avatar_url text,
  kind text NOT NULL CHECK (kind IN ('person', 'bot')),
  contribution_count integer NOT NULL CHECK (contribution_count > 0),
  last_contributed_at timestamptz NOT NULL,
  linked_user_id uuid REFERENCES atlas_auth_users(id) ON DELETE SET NULL,
  UNIQUE (workspace_source_id, provider, provider_account_id)
);

CREATE INDEX atlas_workspace_contributors_workspace_recent_idx
  ON atlas_workspace_contributors (workspace_id, last_contributed_at DESC);

CREATE INDEX atlas_workspace_contributors_linked_user_idx
  ON atlas_workspace_contributors (linked_user_id)
  WHERE linked_user_id IS NOT NULL;
