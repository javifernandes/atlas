import type { BetterAuthOptions } from 'better-auth';
import type { Pool } from 'pg';

export const atlasAccountLinkingPolicy = {
  allowDifferentEmails: true,
  allowUnlinkingAll: false,
  disableImplicitLinking: true,
  enabled: true,
  updateUserInfoOnLink: false,
} as const;

export const atlasAuthDatabaseModels = {
  account: {
    fields: {
      accessToken: 'access_token',
      accessTokenExpiresAt: 'access_token_expires_at',
      accountId: 'account_id',
      createdAt: 'created_at',
      idToken: 'id_token',
      providerId: 'provider_id',
      refreshToken: 'refresh_token',
      refreshTokenExpiresAt: 'refresh_token_expires_at',
      updatedAt: 'updated_at',
      userId: 'user_id',
    },
    modelName: 'atlas_auth_accounts',
  },
  session: {
    fields: {
      createdAt: 'created_at',
      expiresAt: 'expires_at',
      ipAddress: 'ip_address',
      updatedAt: 'updated_at',
      userAgent: 'user_agent',
      userId: 'user_id',
    },
    modelName: 'atlas_auth_sessions',
  },
  user: {
    fields: {
      createdAt: 'created_at',
      emailVerified: 'email_verified',
      updatedAt: 'updated_at',
    },
    modelName: 'atlas_auth_users',
  },
  verification: {
    fields: {
      createdAt: 'created_at',
      expiresAt: 'expires_at',
      updatedAt: 'updated_at',
    },
    modelName: 'atlas_auth_verifications',
  },
} as const;

type ProviderAccountTokens = {
  accessToken?: string | null;
  accessTokenExpiresAt?: Date | null;
  idToken?: string | null;
  refreshToken?: string | null;
  refreshTokenExpiresAt?: Date | null;
};

export const discardProviderTokens = <T extends ProviderAccountTokens>(account: T) => ({
  ...account,
  accessToken: null,
  accessTokenExpiresAt: null,
  idToken: null,
  refreshToken: null,
  refreshTokenExpiresAt: null,
});

export const atlasAuthDatabaseHooks = {
  account: {
    create: {
      before: async account => ({ data: discardProviderTokens(account) }),
    },
    update: {
      before: async account => ({ data: discardProviderTokens(account) }),
    },
  },
} satisfies NonNullable<BetterAuthOptions['databaseHooks']>;

export const createAtlasAuthPersistenceOptions = (
  database?: Pool,
): BetterAuthOptions => ({
  advanced: {
    database: {
      generateId: 'uuid',
      joins: true,
    },
  },
  account: {
    ...atlasAuthDatabaseModels.account,
    accountLinking: atlasAccountLinkingPolicy,
    storeAccountCookie: false,
    updateAccountOnSignIn: false,
  },
  database,
  databaseHooks: atlasAuthDatabaseHooks,
  session: atlasAuthDatabaseModels.session,
  user: atlasAuthDatabaseModels.user,
  verification: atlasAuthDatabaseModels.verification,
});
