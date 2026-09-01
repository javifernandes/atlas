import { createSign } from 'node:crypto';

import { getAtlasGitHubAppConfig } from './app-config';

const githubApiBaseUrl = 'https://api.github.com';
const githubApiVersion = '2022-11-28';
const userAgent = 'atlas-github-app';

type InstallationToken = {
  expiresAt: number;
  token: string;
};

const installationTokens = new Map<string, InstallationToken>();

const base64UrlEncode = (value: string | Buffer) => Buffer.from(value).toString('base64url');

export const createAtlasGitHubAppJwt = (
  credentials: { appId: string; privateKey: string },
  issuedAtSeconds = Math.floor(Date.now() / 1000),
) => {
  const header = base64UrlEncode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64UrlEncode(
    JSON.stringify({
      exp: issuedAtSeconds + 9 * 60,
      iat: issuedAtSeconds - 60,
      iss: credentials.appId,
    }),
  );
  const unsignedToken = `${header}.${payload}`;
  const signer = createSign('RSA-SHA256');

  signer.update(unsignedToken);
  signer.end();

  return `${unsignedToken}.${signer.sign(credentials.privateKey).toString('base64url')}`;
};

const githubHeaders = (authorization?: string, accept = 'application/vnd.github+json') => ({
  Accept: accept,
  ...(authorization ? { Authorization: authorization } : {}),
  'User-Agent': userAgent,
  'X-GitHub-Api-Version': githubApiVersion,
});

const readJson = async (response: Response): Promise<unknown> => {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    throw new Error('GitHub returned invalid JSON', { cause: error });
  }
};

const readGitHubResponse = async (response: Response): Promise<unknown> => {
  const body = await readJson(response);

  if (!response.ok) {
    const message =
      body && typeof body === 'object' && 'message' in body && typeof body.message === 'string'
        ? body.message
        : `GitHub request failed with ${response.status}`;

    throw new Error(message);
  }

  return body;
};

const requireAppCredentials = () => {
  const config = getAtlasGitHubAppConfig();

  return config.appId && config.privateKey
    ? { appId: config.appId, privateKey: config.privateKey }
    : null;
};

const getNumericId = (body: unknown) => {
  if (!body || typeof body !== 'object' || !('id' in body)) {
    return null;
  }

  return typeof body.id === 'number' || typeof body.id === 'string' ? String(body.id) : null;
};

const getInstallationTokenBody = (body: unknown) => {
  if (!body || typeof body !== 'object' || !('token' in body) || typeof body.token !== 'string') {
    return null;
  }

  const expiresAt =
    'expires_at' in body && typeof body.expires_at === 'string'
      ? Date.parse(body.expires_at)
      : Date.now() + 50 * 60 * 1000;

  return {
    token: body.token,
    expiresAt: Number.isFinite(expiresAt) ? expiresAt : Date.now() + 50 * 60 * 1000,
  };
};

const requestInstallationToken = async (
  repositoryFullName: string,
  fetcher: typeof fetch,
): Promise<string | null> => {
  const credentials = requireAppCredentials();

  if (!credentials) {
    return null;
  }

  const cached = installationTokens.get(repositoryFullName.toLowerCase());

  if (cached && cached.expiresAt - 60_000 > Date.now()) {
    return cached.token;
  }

  const jwt = createAtlasGitHubAppJwt(credentials);
  const installationResponse = await fetcher(
    `${githubApiBaseUrl}/repos/${repositoryFullName}/installation`,
    {
      cache: 'no-store',
      headers: githubHeaders(`Bearer ${jwt}`),
    },
  );
  const installationId = getNumericId(await readGitHubResponse(installationResponse));

  if (!installationId) {
    throw new Error(`GitHub returned an invalid installation for ${repositoryFullName}`);
  }

  const tokenResponse = await fetcher(
    `${githubApiBaseUrl}/app/installations/${encodeURIComponent(installationId)}/access_tokens`,
    {
      cache: 'no-store',
      headers: githubHeaders(`Bearer ${jwt}`),
      method: 'POST',
    },
  );
  const token = getInstallationTokenBody(await readGitHubResponse(tokenResponse));

  if (!token) {
    throw new Error(`GitHub returned an invalid installation token for ${repositoryFullName}`);
  }

  installationTokens.set(repositoryFullName.toLowerCase(), token);

  return token.token;
};

export const getAtlasGitHubRequestHeaders = async (input: {
  accept?: string;
  fetcher?: typeof fetch;
  repositoryFullName: string;
}) => {
  const fallbackToken = process.env.ATLAS_GITHUB_TOKEN?.trim();
  const installationToken = await requestInstallationToken(
    input.repositoryFullName,
    input.fetcher ?? fetch,
  );
  const token = installationToken ?? fallbackToken;

  return githubHeaders(token ? `Bearer ${token}` : undefined, input.accept);
};

export const clearAtlasGitHubInstallationTokenCache = () => installationTokens.clear();
