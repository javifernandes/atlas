import type { PostgresDataGraphMappingOverrides } from '@ontahi/postgres/data-graph';

export const atlasPostgresMappingOverrides = {
  AtlasUser: { table: 'atlas_auth_users' },
  AtlasAuthAccount: { table: 'atlas_auth_accounts' },
  AtlasWorkspace: { table: 'atlas_workspaces' },
  AtlasWorkspaceMembership: { table: 'atlas_workspace_memberships' },
  AtlasWorkspaceSource: { table: 'atlas_workspace_sources' },
  AtlasWorkspaceContributor: { table: 'atlas_workspace_contributors' },
  AtlasWorkspaceSourceImport: { table: 'atlas_workspace_source_imports' },
  AtlasWorkspaceProjectionRevision: { table: 'atlas_workspace_projection_revisions' },
  AtlasExecutionStream: { table: 'atlas_execution_streams' },
  AtlasExecutionStreamActivity: { table: 'atlas_execution_stream_activities' },
  AtlasExecutionStreamRoot: { table: 'atlas_execution_stream_roots' },
  AtlasTypeBinding: { table: 'atlas_type_bindings' },
} satisfies PostgresDataGraphMappingOverrides;
