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

export const createAtlasAuthPersistenceOptions = (
  database?: Pool,
): BetterAuthOptions => {
  // Better Auth's built-in memory adapter registers its models under the canonical
  // user/session/account/verification names. Atlas' physical table and column mapping is only
  // meaningful for PostgreSQL; applying it to the memory adapter makes OAuth callbacks query
  // models that do not exist (for example atlas_auth_accounts).
  const databaseModels = database ? atlasAuthDatabaseModels : undefined;

  return {
    advanced: {
      database: {
        generateId: 'uuid',
        joins: true,
      },
    },
    account: {
      ...databaseModels?.account,
      accountLinking: atlasAccountLinkingPolicy,
      encryptOAuthTokens: true,
      storeAccountCookie: false,
      updateAccountOnSignIn: true,
    },
    database,
    session: {
      ...databaseModels?.session,
      cookieCache: {
        // Better Auth decodes an existing session_data cookie before checking enabled. Keep the
        // stateless JWE codec during the PostgreSQL rollout so prior cookies expire as sessions
        // instead of being parsed as compact Base64 and crashing the request.
        enabled: !database,
        strategy: 'jwe',
      },
    },
    user: databaseModels?.user,
    verification: databaseModels?.verification,
  };
};
