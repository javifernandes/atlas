import { betterAuth, type BetterAuthOptions } from 'better-auth';
import type { Pool } from 'pg';

import { getAtlasPostgresPool } from '../database/postgres-pool';

import { decideAtlasReadAccess, type AtlasReadAccess, type AtlasViewer } from './access';
import {
  isGithubProfileAllowed,
  readAtlasAuthConfiguration,
  type AtlasAuthConfiguration,
} from './config';
import { createAtlasAuthPersistenceOptions } from './persistence';

export class AtlasAuthConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AtlasAuthConfigurationError';
  }
}

export const createAtlasAuthOptions = (
  configuration: AtlasAuthConfiguration,
  database?: Pool,
): BetterAuthOptions => {
  if (
    !configuration.authAvailable ||
    !configuration.baseUrl ||
    !configuration.clientId ||
    !configuration.clientSecret ||
    !configuration.secret
  ) {
    throw new AtlasAuthConfigurationError('Atlas GitHub authentication is not configured.');
  }

  const persistenceOptions = createAtlasAuthPersistenceOptions(database);

  return {
    ...persistenceOptions,
    appName: 'Atlas',
    baseURL: configuration.baseUrl,
    secret: configuration.secret,
    socialProviders: {
      github: {
        clientId: configuration.clientId,
        clientSecret: configuration.clientSecret,
      },
    },
    user: {
      ...persistenceOptions.user,
      validateUserInfo: ({ source }) => {
        if (source.oauth?.providerId !== 'github') {
          return {
            error: 'unsupported_identity_provider',
            errorDescription: 'Atlas currently accepts GitHub identities only.',
          };
        }

        if (!isGithubProfileAllowed(configuration, source.oauth.profile)) {
          return {
            error: 'github_user_not_allowed',
            errorDescription: 'This GitHub account does not have access to this private Atlas.',
          };
        }
      },
    },
  };
};

export const createAtlasAuth = (
  configuration: AtlasAuthConfiguration,
  database = configuration.databaseUrl
    ? getAtlasPostgresPool(configuration.databaseUrl)
    : undefined,
) => betterAuth(createAtlasAuthOptions(configuration, database));

type AtlasAuth = ReturnType<typeof createAtlasAuth>;

let cachedAuth: { auth: AtlasAuth; configurationKey: string } | null = null;

const getConfigurationKey = (configuration: AtlasAuthConfiguration) =>
  JSON.stringify({
    baseUrl: configuration.baseUrl,
    clientId: configuration.clientId,
    clientSecret: configuration.clientSecret,
    databaseUrl: configuration.databaseUrl,
    privateGithubUserIds: [...configuration.privateGithubUserIds].sort(),
    secret: configuration.secret,
    visibility: configuration.visibility,
  });

export const getAtlasAuth = () => {
  const configuration = readAtlasAuthConfiguration();
  const configurationKey = getConfigurationKey(configuration);

  if (cachedAuth?.configurationKey !== configurationKey) {
    cachedAuth = {
      auth: createAtlasAuth(configuration),
      configurationKey,
    };
  }

  return cachedAuth.auth;
};

const readAtlasViewer = async (headers: Headers): Promise<AtlasViewer | null> => {
  const configuration = readAtlasAuthConfiguration();

  if (!configuration.authAvailable) {
    return null;
  }

  const session = await getAtlasAuth().api.getSession({ headers });

  return session
    ? {
        email: session.user.email,
        id: session.user.id,
        image: session.user.image ?? null,
        name: session.user.name,
      }
    : null;
};

export const getAtlasRequestAccess = async (headers: Headers): Promise<AtlasReadAccess> => {
  const configuration = readAtlasAuthConfiguration();

  if (configuration.configurationError) {
    return decideAtlasReadAccess(configuration, null);
  }

  return decideAtlasReadAccess(configuration, await readAtlasViewer(headers));
};
