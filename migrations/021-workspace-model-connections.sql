CREATE TABLE atlas_workspace_model_connections (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES atlas_workspaces(id) ON DELETE CASCADE,
  purpose text NOT NULL CHECK (purpose IN ('plans-assistant')),
  provider text NOT NULL CHECK (provider IN ('openai', 'anthropic')),
  model text NOT NULL,
  base_url text,
  secret_ref text NOT NULL,
  secret_suffix text,
  status text NOT NULL CHECK (status IN ('active', 'disabled')),
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX atlas_workspace_model_connections_workspace_purpose_uidx
  ON atlas_workspace_model_connections (workspace_id, purpose);

