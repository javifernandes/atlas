ALTER TABLE atlas_workspace_source_imports
  DROP CONSTRAINT atlas_workspace_source_imports_trigger_check;

ALTER TABLE atlas_workspace_source_imports
  ADD CONSTRAINT atlas_workspace_source_imports_trigger_check
  CHECK (trigger IN ('connection', 'manual', 'push', 'pull-request', 'source-removal'));
