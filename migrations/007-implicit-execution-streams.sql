ALTER TABLE pull_requests
  ADD COLUMN author_provider_account_id text;

CREATE INDEX pull_requests_author_provider_account_idx
  ON pull_requests (author_provider_account_id);

CREATE TABLE atlas_execution_streams (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES atlas_auth_users(id) ON DELETE CASCADE,
  mode text NOT NULL CHECK (mode IN ('implicit', 'explicit')),
  status text NOT NULL CHECK (status IN ('open', 'closed')),
  title text NOT NULL,
  current_focus_plan_id text REFERENCES atlas_plans(id) ON DELETE SET NULL,
  opened_at timestamptz NOT NULL,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (
    (status = 'open' AND closed_at IS NULL)
    OR (status = 'closed' AND closed_at IS NOT NULL)
  )
);

CREATE UNIQUE INDEX atlas_execution_streams_one_open_implicit_per_user_uidx
  ON atlas_execution_streams (user_id)
  WHERE status = 'open' AND mode = 'implicit';

CREATE INDEX atlas_execution_streams_user_recent_idx
  ON atlas_execution_streams (user_id, opened_at DESC);

CREATE INDEX atlas_execution_streams_focus_plan_idx
  ON atlas_execution_streams (current_focus_plan_id);

CREATE TABLE atlas_execution_stream_roots (
  id text PRIMARY KEY,
  stream_id uuid NOT NULL REFERENCES atlas_execution_streams(id) ON DELETE CASCADE,
  plan_id text NOT NULL REFERENCES atlas_plans(id) ON DELETE CASCADE,
  added_at timestamptz NOT NULL,
  UNIQUE (stream_id, plan_id)
);

CREATE INDEX atlas_execution_stream_roots_stream_idx
  ON atlas_execution_stream_roots (stream_id);

CREATE INDEX atlas_execution_stream_roots_plan_idx
  ON atlas_execution_stream_roots (plan_id);

CREATE TABLE atlas_execution_stream_activities (
  id text PRIMARY KEY,
  stream_id uuid NOT NULL REFERENCES atlas_execution_streams(id) ON DELETE CASCADE,
  pull_request_id text NOT NULL REFERENCES pull_requests(id) ON DELETE CASCADE,
  plan_id text REFERENCES atlas_plans(id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind = 'pull-request-merged'),
  attribution text NOT NULL CHECK (attribution = 'implicit-single-open'),
  occurred_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (pull_request_id)
);

CREATE INDEX atlas_execution_stream_activities_stream_recent_idx
  ON atlas_execution_stream_activities (stream_id, occurred_at DESC);

CREATE INDEX atlas_execution_stream_activities_plan_idx
  ON atlas_execution_stream_activities (plan_id);
