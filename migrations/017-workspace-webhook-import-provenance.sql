ALTER TABLE atlas_workspace_source_imports
  ADD COLUMN provider_delivery_id text,
  ADD COLUMN trigger_revision text,
  ADD COLUMN pull_request_number integer;

CREATE UNIQUE INDEX atlas_workspace_source_imports_workspace_delivery_uidx
  ON atlas_workspace_source_imports (workspace_id, provider_delivery_id)
  WHERE provider_delivery_id IS NOT NULL;

-- The canonical Workspace may have been created before any Atlas User existed. Reconcile its
-- first durable owner idempotently once a production identity is present.
INSERT INTO atlas_workspace_memberships (workspace_id, user_id, role, status)
SELECT
  '00000000-0000-4000-8000-000000000137',
  users.id,
  'owner',
  'active'
FROM atlas_auth_users AS users
ORDER BY users.created_at ASC, users.id ASC
LIMIT 1
ON CONFLICT (workspace_id, user_id) DO UPDATE
SET role = 'owner', status = 'active', updated_at = CURRENT_TIMESTAMP;
