DROP INDEX atlas_workspace_model_connections_workspace_purpose_uidx;

CREATE UNIQUE INDEX atlas_workspace_model_connections_workspace_purpose_provider_uidx
  ON atlas_workspace_model_connections (workspace_id, purpose, provider);

CREATE UNIQUE INDEX atlas_workspace_model_connections_one_active_uidx
  ON atlas_workspace_model_connections (workspace_id, purpose)
  WHERE status = 'active';
