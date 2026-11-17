ALTER TABLE atlas_workspace_model_connections
  DROP CONSTRAINT atlas_workspace_model_connections_provider_check;

ALTER TABLE atlas_workspace_model_connections
  ADD CONSTRAINT atlas_workspace_model_connections_provider_check
  CHECK (provider IN ('openai', 'anthropic', 'deepseek'));
