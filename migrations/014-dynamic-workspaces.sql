ALTER TABLE atlas_workspace_memberships
  DROP CONSTRAINT atlas_workspace_memberships_role_check;

UPDATE atlas_workspace_memberships
SET role = 'collaborator', updated_at = CURRENT_TIMESTAMP
WHERE role = 'editor';

ALTER TABLE atlas_workspace_memberships
  ADD CONSTRAINT atlas_workspace_memberships_role_check
  CHECK (role IN ('owner', 'collaborator', 'viewer'));
