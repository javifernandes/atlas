import type { PostgresDataGraphMappingOverrides } from '@ontahi/postgres/data-graph';

export const atlasPostgresMappingOverrides = {
  AtlasUser: { table: 'atlas_auth_users' },
  AtlasAuthAccount: { table: 'atlas_auth_accounts' },
  AtlasExecutionStream: { table: 'atlas_execution_streams' },
  AtlasExecutionStreamActivity: { table: 'atlas_execution_stream_activities' },
  AtlasExecutionStreamRoot: { table: 'atlas_execution_stream_roots' },
} satisfies PostgresDataGraphMappingOverrides;
