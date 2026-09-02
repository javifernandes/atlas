ALTER TABLE projection_revisions
  ADD COLUMN diagnostics_json text NOT NULL DEFAULT '{}';

ALTER TABLE projection_revisions
  DROP CONSTRAINT projection_revisions_status_check;

ALTER TABLE projection_revisions
  ADD CONSTRAINT projection_revisions_status_check
  CHECK (status IN ('completed', 'degraded'));
