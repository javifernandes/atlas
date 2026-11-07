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
} from '../atlas/github/user-repositories';
import { getAtlasRepoRoot } from '../atlas/server/atlas-postgres-composition';
import {
  ATLAS_WORKSPACE_SOURCE_RECONCILIATION_RESOURCE,
  reconcileAtlasWorkspaceSources,
} from '../atlas/workspace/workspace-source-reconciliation';
import { getAtlasGitHubAppInstallationUrl } from '../atlas/github/installation-client';
import { listAtlasGitHubInstallationRepositories } from '../atlas/github/user-installations';

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
        scope: ['read:user', 'user:email'],
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

  let githubAccessToken: Promise<string | null> | null = null;
  const resolveGitHubAccessToken = () => {
    githubAccessToken ??= (async () => {
      if (!access.viewer) return null;
      const auth = getAtlasAuth();
      const accounts = await auth.api.listUserAccounts({ headers: request.headers });
      const githubAccounts = accounts.filter(account => account.providerId === 'github');
      for (const githubAccount of githubAccounts) {
        try {
          const token = await auth.api.getAccessToken({
            body: { accountId: githubAccount.id },
            headers: request.headers,
          });
          if (token.accessToken) return token.accessToken;
        } catch {
          // A stale linked account must not hide a later valid GitHub credential.
        }
      }
      return null;
    })();
    return githubAccessToken;
  };
  const githubFetcher: typeof fetch = async (input, init) => {
    const accessToken = await resolveGitHubAccessToken();
    if (!accessToken) throw new Error('GitHub repository authorization is required.');
    const headers = new Headers(init?.headers);
    if (!headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${accessToken}`);
    }
    headers.set('User-Agent', 'atlas-workspace-source-import');
    headers.set('X-GitHub-Api-Version', '2022-11-28');
    const { next: _next, ...requestInit } = init as RequestInit & { next?: unknown };
    return fetch(input, { ...requestInit, cache: 'no-store', headers });
  };

  return {
    principal: access.principal,
    resourceEvidenceDisclosure:
      process.env.NODE_ENV === 'production' ? 'none' as const : 'debug' as const,
    workspace: access.viewer
      ? await getAtlasWorkspaceAuthorityForUser(access.viewer.id, workspaceSlug)
      : null,
    resources: new Map<string, unknown>([
      [
        ATLAS_GITHUB_REPOSITORY_DISCOVERY_RESOURCE,
        {
          installationUrl: () => getAtlasGitHubAppInstallationUrl(),
          list: async () => {
            const installationUrl = await getAtlasGitHubAppInstallationUrl();
            if (!access.viewer) return { connectionRequired: true as const, installationUrl, repositories: [] };
            const accessToken = await resolveGitHubAccessToken();
            if (!accessToken) return { connectionRequired: true as const, installationUrl, repositories: [] };

            return listAtlasGitHubInstallationRepositories({
              accessToken,
              installationUrl,
            });
          },
        },
      ],
      [
        ATLAS_WORKSPACE_SOURCE_RECONCILIATION_RESOURCE,
        {
          reconcile: ({ sources }: { sources: Array<{ id: string; ref: string; repository: string }> }) =>
            reconcileAtlasWorkspaceSources({
              fetcher: githubFetcher,
              repoRoot: getAtlasRepoRoot(),
              sources,
            }),
        },
      ],
    ]),
  };
};
