import { inferPostgresMappings } from '@ontahi/postgres/data-graph';
import { describe, expect, it } from 'vitest';

import { atlasEntities } from '../domain/atlas-application';
import { atlasPostgresMappingOverrides } from './postgres-mapping';

describe('Atlas PostgreSQL identity mappings', () => {
  it('maps Ontahí identity Entities onto Better Auth tables without credential fields', () => {
    const mappings = inferPostgresMappings(atlasEntities, {
      overrides: atlasPostgresMappingOverrides,
    });
    const user = mappings.find(mapping => mapping.entity.name === 'AtlasUser');
    const account = mappings.find(mapping => mapping.entity.name === 'AtlasAuthAccount');

    expect(user).toMatchObject({
      table: 'atlas_auth_users',
      columns: {
        id: 'id',
        email: 'email',
        emailVerified: 'email_verified',
      },
    });
    expect(account).toEqual({
      entity: expect.objectContaining({ name: 'AtlasAuthAccount' }),
      table: 'atlas_auth_accounts',
      columns: {
        id: 'id',
        issuer: 'issuer',
        accountId: 'account_id',
        providerId: 'provider_id',
        userId: 'user_id',
        createdAt: 'created_at',
        updatedAt: 'updated_at',
      },
    });
  });
});
