CREATE TABLE atlas_workspace_invitations (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES atlas_workspaces(id) ON DELETE CASCADE,
  invited_by_user_id uuid NOT NULL REFERENCES atlas_auth_users(id) ON DELETE RESTRICT,
  recipient_kind text NOT NULL CHECK (recipient_kind IN ('user', 'github')),
  recipient_user_id uuid REFERENCES atlas_auth_users(id) ON DELETE CASCADE,
  recipient_provider text CHECK (recipient_provider = 'github'),
  recipient_provider_account_id text,
  claim_policy text NOT NULL CHECK (claim_policy IN ('known-user', 'provider-identity')),
  proposed_role text NOT NULL CHECK (proposed_role IN ('collaborator', 'viewer')),
  status text NOT NULL CHECK (status IN ('pending', 'claimed', 'accepted', 'declined', 'revoked', 'expired')),
  claimed_by_user_id uuid REFERENCES atlas_auth_users(id) ON DELETE SET NULL,
  membership_id uuid REFERENCES atlas_workspace_memberships(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (
    (recipient_kind = 'user' AND recipient_user_id IS NOT NULL AND recipient_provider IS NULL AND recipient_provider_account_id IS NULL AND claim_policy = 'known-user')
    OR
    (recipient_kind = 'github' AND recipient_user_id IS NULL AND recipient_provider = 'github' AND recipient_provider_account_id IS NOT NULL AND claim_policy = 'provider-identity')
  )
);

CREATE INDEX atlas_workspace_invitations_workspace_status_idx
  ON atlas_workspace_invitations (workspace_id, status, created_at DESC);

CREATE UNIQUE INDEX atlas_workspace_invitations_pending_user_uidx
  ON atlas_workspace_invitations (workspace_id, recipient_user_id)
  WHERE status IN ('pending', 'claimed') AND recipient_user_id IS NOT NULL;

CREATE UNIQUE INDEX atlas_workspace_invitations_pending_provider_uidx
  ON atlas_workspace_invitations (workspace_id, recipient_provider, recipient_provider_account_id)
  WHERE status IN ('pending', 'claimed') AND recipient_provider_account_id IS NOT NULL;
