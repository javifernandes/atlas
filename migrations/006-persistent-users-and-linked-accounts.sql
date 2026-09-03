CREATE TABLE atlas_auth_users (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  email_verified boolean NOT NULL DEFAULT false,
  image text,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX atlas_auth_users_email_uidx
  ON atlas_auth_users (email);

CREATE TABLE atlas_auth_sessions (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  expires_at timestamptz NOT NULL,
  token text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ip_address text,
  user_agent text,
  user_id uuid NOT NULL REFERENCES atlas_auth_users(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX atlas_auth_sessions_token_uidx
  ON atlas_auth_sessions (token);

CREATE INDEX atlas_auth_sessions_user_id_idx
  ON atlas_auth_sessions (user_id);

CREATE TABLE atlas_auth_accounts (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  issuer text NOT NULL,
  account_id text NOT NULL,
  provider_id text NOT NULL,
  user_id uuid NOT NULL REFERENCES atlas_auth_users(id) ON DELETE CASCADE,
  access_token text,
  refresh_token text,
  id_token text,
  access_token_expires_at timestamptz,
  refresh_token_expires_at timestamptz,
  scope text,
  password text,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX atlas_auth_accounts_issuer_account_id_uidx
  ON atlas_auth_accounts (issuer, account_id);

CREATE INDEX atlas_auth_accounts_user_id_idx
  ON atlas_auth_accounts (user_id);

CREATE TABLE atlas_auth_verifications (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  identifier text NOT NULL,
  value text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX atlas_auth_verifications_identifier_idx
  ON atlas_auth_verifications (identifier);
