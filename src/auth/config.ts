export type AtlasVisibility = 'public' | 'private';

type AtlasAuthEnvironment = Record<string, string | undefined>;

export type AtlasAuthConfiguration = {
  authAvailable: boolean;
  baseUrl: string | null;
  clientId: string | null;
  clientSecret: string | null;
  configurationError: string | null;
  privateGithubUserIds: ReadonlySet<string>;
  secret: string | null;
  visibility: AtlasVisibility;
};

const readValue = (value: string | undefined) => {
  const normalized = value?.trim();
  return normalized ? normalized : null;
};

export const parsePrivateGithubUserIds = (value: string | undefined) =>
  new Set(
    (value ?? '')
      .split(',')
      .map(userId => userId.trim())
      .filter(Boolean),
  );

export const readAtlasAuthConfiguration = (
  environment: AtlasAuthEnvironment = process.env,
): AtlasAuthConfiguration => {
  const visibilityValue = readValue(environment.ATLAS_VISIBILITY) ?? 'public';
  const visibility = visibilityValue === 'private' ? 'private' : 'public';
  const clientId = readValue(environment.ATLAS_AUTH_GITHUB_CLIENT_ID);
  const clientSecret = readValue(environment.ATLAS_AUTH_GITHUB_CLIENT_SECRET);
  const secret = readValue(environment.BETTER_AUTH_SECRET);
  const baseUrl = readValue(environment.BETTER_AUTH_URL);
  const privateGithubUserIds = parsePrivateGithubUserIds(
    environment.ATLAS_PRIVATE_GITHUB_USER_IDS,
  );
  const authParts = [clientId, clientSecret, secret, baseUrl];
  const authAvailable = authParts.every(Boolean);
  let configurationError: string | null = null;

  if (visibilityValue !== 'public' && visibilityValue !== 'private') {
    configurationError = `ATLAS_VISIBILITY must be "public" or "private", received "${visibilityValue}".`;
  } else if (visibility === 'private' && !authAvailable) {
    configurationError =
      'Private Atlas visibility requires GitHub OAuth, BETTER_AUTH_SECRET, and BETTER_AUTH_URL.';
  } else if (visibility === 'private' && privateGithubUserIds.size === 0) {
    configurationError =
      'Private Atlas visibility requires at least one ATLAS_PRIVATE_GITHUB_USER_IDS entry.';
  }

  return {
    authAvailable,
    baseUrl,
    clientId,
    clientSecret,
    configurationError,
    privateGithubUserIds,
    secret,
    visibility,
  };
};

export const isGithubProfileAllowed = (
  configuration: AtlasAuthConfiguration,
  profile: Record<string, unknown> | undefined,
) => {
  if (configuration.visibility === 'public') {
    return true;
  }

  const userId =
    typeof profile?.id === 'string' || typeof profile?.id === 'number'
      ? String(profile.id)
      : null;
  return userId ? configuration.privateGithubUserIds.has(userId) : false;
};
