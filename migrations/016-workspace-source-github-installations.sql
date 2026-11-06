ALTER TABLE atlas_workspace_sources
  ADD COLUMN provider_installation_id text;

CREATE INDEX atlas_workspace_sources_github_installation_repository_idx
  ON atlas_workspace_sources (provider_installation_id, lower(repository))
  WHERE provider = 'github' AND status = 'active';
