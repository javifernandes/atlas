CREATE TABLE atlas_workspaces (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  slug text NOT NULL,
  name text NOT NULL,
  visibility text NOT NULL CHECK (visibility IN ('private', 'public')),
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX atlas_workspaces_slug_uidx
  ON atlas_workspaces (slug);

CREATE TABLE atlas_workspace_memberships (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES atlas_workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES atlas_auth_users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner', 'editor', 'viewer')),
  status text NOT NULL CHECK (status IN ('active', 'suspended')),
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX atlas_workspace_memberships_workspace_user_uidx
  ON atlas_workspace_memberships (workspace_id, user_id);

CREATE INDEX atlas_workspace_memberships_user_active_idx
  ON atlas_workspace_memberships (user_id, workspace_id)
  WHERE status = 'active';

INSERT INTO atlas_workspaces (id, slug, name, visibility)
VALUES (
  '00000000-0000-4000-8000-000000000137',
  'atlas',
  'Atlas',
  'private'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO atlas_workspace_memberships (workspace_id, user_id, role, status)
SELECT
  '00000000-0000-4000-8000-000000000137',
  users.id,
  'owner',
  'active'
FROM atlas_auth_users AS users
ORDER BY users.created_at ASC, users.id ASC
LIMIT 1
ON CONFLICT (workspace_id, user_id) DO NOTHING;
