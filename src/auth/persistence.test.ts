import { describe, expect, it } from 'vitest';
import type { Pool } from 'pg';

import {
  atlasAccountLinkingPolicy,
  atlasAuthDatabaseModels,
  createAtlasAuthPersistenceOptions,
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

  it('binds PostgreSQL auth to Atlas-owned table and column names', () => {
    expect(atlasAuthDatabaseModels).toMatchObject({
      account: {
        fields: { accountId: 'account_id', userId: 'user_id' },
        modelName: 'atlas_auth_accounts',
      },
      session: { modelName: 'atlas_auth_sessions' },
      user: { modelName: 'atlas_auth_users' },
      verification: { modelName: 'atlas_auth_verifications' },
    });

    const postgres = {} as Pool;
    expect(createAtlasAuthOptions(configuredAuth, postgres)).toMatchObject({
      account: {
        accountLinking: atlasAccountLinkingPolicy,
        encryptOAuthTokens: true,
        modelName: 'atlas_auth_accounts',
        storeAccountCookie: false,
        updateAccountOnSignIn: true,
      },
      advanced: { database: { generateId: 'uuid', joins: true } },
      database: postgres,
      session: { modelName: 'atlas_auth_sessions' },
      user: { modelName: 'atlas_auth_users' },
      verification: { modelName: 'atlas_auth_verifications' },
      socialProviders: {
        github: { scope: ['repo'] },
      },
    });
    expect(createAtlasAuthPersistenceOptions(postgres)).toMatchObject({
      account: { accountLinking: atlasAccountLinkingPolicy },
      database: postgres,
      user: { modelName: 'atlas_auth_users' },
    });
  });

  it('keeps canonical model names for Better Auth\'s local memory adapter', () => {
    const local = createAtlasAuthOptions(configuredAuth);

    expect(local.database).toBeUndefined();
    expect(local.account).not.toHaveProperty('modelName');
    expect(local.session).not.toHaveProperty('modelName');
    expect(local.user).not.toHaveProperty('modelName');
    expect(local.verification).toBeUndefined();
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

  it('encrypts delegated provider credentials and refreshes them on sign-in', () => {
    expect(createAtlasAuthPersistenceOptions().account).toMatchObject({
      encryptOAuthTokens: true,
      updateAccountOnSignIn: true,
    });
  });
});
