import type { PostgresDataGraphMappingOverrides } from '@ontahi/postgres/data-graph';

export const atlasPostgresMappingOverrides = {
  AtlasUser: { table: 'atlas_auth_users' },
  AtlasAuthAccount: { table: 'atlas_auth_accounts' },
} satisfies PostgresDataGraphMappingOverrides;
