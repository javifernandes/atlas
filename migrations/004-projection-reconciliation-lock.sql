CREATE TABLE projection_reconciliation_locks (
  id text PRIMARY KEY,
  processing_token text NOT NULL,
  acquired_at timestamptz NOT NULL
);
