import type { PostgresDataGraphMappingOverrides } from '@ontahi/postgres/data-graph';

export const atlasPostgresMappingOverrides = {
  AtlasUser: { table: 'atlas_auth_users' },
  AtlasAuthAccount: { table: 'atlas_auth_accounts' },
  AtlasWorkspace: { table: 'atlas_workspaces' },
  AtlasWorkspaceMembership: { table: 'atlas_workspace_memberships' },
  AtlasExecutionStream: { table: 'atlas_execution_streams' },
  AtlasExecutionStreamActivity: { table: 'atlas_execution_stream_activities' },
  AtlasExecutionStreamRoot: { table: 'atlas_execution_stream_roots' },
} satisfies PostgresDataGraphMappingOverrides;
