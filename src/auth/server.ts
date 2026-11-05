import { betterAuth, type BetterAuthOptions } from 'better-auth';
import type { Pool } from 'pg';

import { getAtlasPostgresPool } from '../database/postgres-pool';
import { getAtlasWorkspaceAuthorityForUser } from '../atlas/workspace/workspace-access';

import { decideAtlasReadAccess, type AtlasReadAccess, type AtlasViewer } from './access';
import {
  readAtlasAuthConfiguration,
  type AtlasAuthConfiguration,
} from './config';
import { createAtlasAuthPersistenceOptions } from './persistence';
import {
  ATLAS_GITHUB_REPOSITORY_DISCOVERY_RESOURCE,
  type AtlasGitHubRepositoryChoice,
} from '../atlas/github/user-repositories';

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

export const getAtlasRuntimeInvocationContext = async (request: Request) => {
  const access = await getAtlasRequestAccess(request.headers);
  const workspaceSlug = request.headers.get('x-atlas-workspace-slug')?.trim() || undefined;

  if (access.configurationError) {
    throw new AtlasAuthConfigurationError(access.configurationError);
  }

  return {
    principal: access.principal,
    resourceEvidenceDisclosure:
      process.env.NODE_ENV === 'production' ? 'none' as const : 'debug' as const,
    workspace: access.viewer
      ? await getAtlasWorkspaceAuthorityForUser(access.viewer.id, workspaceSlug)
      : null,
    resources: new Map([
      [
        ATLAS_GITHUB_REPOSITORY_DISCOVERY_RESOURCE,
        {
          list: async () => {
            if (!access.viewer) return { authorizationRequired: true as const, repositories: [] };
            const auth = getAtlasAuth();
            const accounts = await auth.api.listUserAccounts({ headers: request.headers });
            const githubAccount = accounts.find(account => account.providerId === 'github');
            if (!githubAccount) {
              return { authorizationRequired: true as const, repositories: [] };
            }
            let accessToken: string;
            try {
              const token = await auth.api.getAccessToken({
                body: { accountId: githubAccount.id },
                headers: request.headers,
              });
              accessToken = token.accessToken;
            } catch {
              return { authorizationRequired: true as const, repositories: [] };
            }
            if (!accessToken) return { authorizationRequired: true as const, repositories: [] };

            const response = await fetch(
              'https://api.github.com/user/repos?affiliation=owner,collaborator,organization_member&per_page=100&sort=updated',
              {
                cache: 'no-store',
                headers: {
                  Accept: 'application/vnd.github+json',
                  Authorization: `Bearer ${accessToken}`,
                  'User-Agent': 'atlas-github-source-picker',
                  'X-GitHub-Api-Version': '2022-11-28',
                },
              },
            );
            if (!response.ok) {
              if (response.status === 401 || response.status === 403) {
                return { authorizationRequired: true as const, repositories: [] };
              }
              throw new Error(`GitHub repository discovery failed with ${response.status}.`);
            }
            const body = await response.json() as Array<{
              default_branch?: unknown;
              full_name?: unknown;
              private?: unknown;
            }>;
            const repositories = body.flatMap((repository): AtlasGitHubRepositoryChoice[] =>
              typeof repository.full_name === 'string' &&
              typeof repository.default_branch === 'string'
                ? [{
                    defaultRef: repository.default_branch,
                    fullName: repository.full_name,
                    isPrivate: repository.private === true,
                  }]
                : [],
            );
            return { authorizationRequired: false as const, repositories };
          },
        },
      ],
    ]),
  };
};
