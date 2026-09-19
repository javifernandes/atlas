ALTER TABLE projection_revisions
  DROP CONSTRAINT projection_revisions_trigger_check;

ALTER TABLE projection_revisions
  ADD CONSTRAINT projection_revisions_trigger_check
  CHECK (trigger IN ('bootstrap', 'catch-up', 'manual', 'rebuild', 'webhook'));
