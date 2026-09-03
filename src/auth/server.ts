import { betterAuth } from 'better-auth';

import { decideAtlasReadAccess, type AtlasReadAccess, type AtlasViewer } from './access';
import {
  isGithubProfileAllowed,
  readAtlasAuthConfiguration,
  type AtlasAuthConfiguration,
} from './config';

export class AtlasAuthConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AtlasAuthConfigurationError';
  }
}

const createAtlasAuth = (configuration: AtlasAuthConfiguration) => {
  if (
    !configuration.authAvailable ||
    !configuration.baseUrl ||
    !configuration.clientId ||
    !configuration.clientSecret ||
    !configuration.secret
  ) {
    throw new AtlasAuthConfigurationError('Atlas GitHub authentication is not configured.');
  }

  return betterAuth({
    account: {
      // Source access belongs to the GitHub App, so the human OAuth token is not retained.
      storeAccountCookie: false,
    },
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
  });
};

type AtlasAuth = ReturnType<typeof createAtlasAuth>;

let cachedAuth: { auth: AtlasAuth; configurationKey: string } | null = null;

const getConfigurationKey = (configuration: AtlasAuthConfiguration) =>
  JSON.stringify({
    baseUrl: configuration.baseUrl,
    clientId: configuration.clientId,
    clientSecret: configuration.clientSecret,
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
