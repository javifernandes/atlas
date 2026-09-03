import { describe, expect, it } from 'vitest';
import type { Pool } from 'pg';

import {
  atlasAccountLinkingPolicy,
  atlasAuthDatabaseModels,
  createAtlasAuthPersistenceOptions,
  discardProviderTokens,
} from './persistence';
import { readAtlasAuthConfiguration } from './config';
import { createAtlasAuthOptions } from './server';

const configuredAuth = readAtlasAuthConfiguration({
  ATLAS_AUTH_GITHUB_CLIENT_ID: 'github-client',
  ATLAS_AUTH_GITHUB_CLIENT_SECRET: 'github-secret',
  BETTER_AUTH_SECRET: 'a-high-entropy-secret-with-at-least-32-characters',
  BETTER_AUTH_URL: 'http://localhost:3000',
});

describe('Atlas persistent user model', () => {
  it('requires explicit account linking and retains at least one login method', () => {
    expect(atlasAccountLinkingPolicy).toEqual({
      allowDifferentEmails: true,
      allowUnlinkingAll: false,
      disableImplicitLinking: true,
      enabled: true,
      updateUserInfoOnLink: false,
    });
  });

  it('binds Better Auth to Atlas-owned table and column names', () => {
    expect(atlasAuthDatabaseModels).toMatchObject({
      account: {
        fields: { accountId: 'account_id', userId: 'user_id' },
        modelName: 'atlas_auth_accounts',
      },
      session: { modelName: 'atlas_auth_sessions' },
      user: { modelName: 'atlas_auth_users' },
      verification: { modelName: 'atlas_auth_verifications' },
    });

    expect(createAtlasAuthOptions(configuredAuth)).toMatchObject({
      account: {
        accountLinking: atlasAccountLinkingPolicy,
        modelName: 'atlas_auth_accounts',
        storeAccountCookie: false,
        updateAccountOnSignIn: false,
      },
      advanced: { database: { generateId: 'uuid', joins: true } },
      database: undefined,
      databaseHooks: expect.any(Object),
      session: { modelName: 'atlas_auth_sessions' },
      user: { modelName: 'atlas_auth_users' },
      verification: { modelName: 'atlas_auth_verifications' },
    });
    expect(createAtlasAuthPersistenceOptions()).toMatchObject({
      account: { accountLinking: atlasAccountLinkingPolicy },
      database: undefined,
      user: { modelName: 'atlas_auth_users' },
    });
  });

  it('keeps the encrypted session cookie codec stable while moving to PostgreSQL', () => {
    expect(createAtlasAuthPersistenceOptions().session?.cookieCache).toEqual({
      enabled: true,
      strategy: 'jwe',
    });
    expect(
      createAtlasAuthPersistenceOptions({} as Pool).session?.cookieCache,
    ).toEqual({
      enabled: false,
      strategy: 'jwe',
    });
  });

  it('discards source-irrelevant provider credentials before persistence', () => {
    expect(
      discardProviderTokens({
        accessToken: 'access-token',
        accessTokenExpiresAt: new Date('2026-09-03T00:00:00.000Z'),
        accountId: 'provider-subject',
        idToken: 'id-token',
        refreshToken: 'refresh-token',
        refreshTokenExpiresAt: new Date('2026-09-04T00:00:00.000Z'),
      }),
    ).toEqual({
      accessToken: null,
      accessTokenExpiresAt: null,
      accountId: 'provider-subject',
      idToken: null,
      refreshToken: null,
      refreshTokenExpiresAt: null,
    });
  });
});
