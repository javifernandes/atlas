export type AtlasVisibility = 'private' | 'public';

type AtlasAuthEnvironment = Record<string, string | undefined>;

export type AtlasAuthConfiguration = {
  authAvailable: boolean;
  baseUrl: string | null;
  clientId: string | null;
  clientSecret: string | null;
  configurationError: string | null;
  databaseUrl: string | null;
  persistence: 'postgres' | 'stateless';
  secret: string | null;
  visibility: AtlasVisibility;
};

const readValue = (value: string | undefined) => {
  const normalized = value?.trim();
  return normalized ? normalized : null;
};

export const readAtlasAuthConfiguration = (
  environment: AtlasAuthEnvironment = process.env,
): AtlasAuthConfiguration => {
  const visibilityValue = readValue(environment.ATLAS_VISIBILITY) ?? 'private';
  const visibility: AtlasVisibility = visibilityValue === 'public' ? 'public' : 'private';
  const clientId = readValue(environment.ATLAS_AUTH_GITHUB_CLIENT_ID);
  const clientSecret = readValue(environment.ATLAS_AUTH_GITHUB_CLIENT_SECRET);
  const secret = readValue(environment.BETTER_AUTH_SECRET);
  const baseUrl = readValue(environment.BETTER_AUTH_URL);
  const databaseUrl = readValue(environment.DATABASE_URL);
  const authParts = [clientId, clientSecret, secret, baseUrl];
  const authAvailable = authParts.every(Boolean);
  let configurationError: string | null = null;

  if (visibilityValue !== 'private' && visibilityValue !== 'public') {
    configurationError = `ATLAS_VISIBILITY must be "private" or "public", received "${visibilityValue}".`;
  } else if (visibility === 'public' && environment.NODE_ENV === 'production') {
    configurationError =
      'Public Atlas visibility is available only in local development.';
  } else if (visibility === 'private' && !authAvailable) {
    configurationError =
      'Private Atlas visibility requires GitHub OAuth, BETTER_AUTH_SECRET, and BETTER_AUTH_URL.';
  }

  return {
    authAvailable,
    baseUrl,
    clientId,
    clientSecret,
    configurationError,
    databaseUrl,
    persistence: databaseUrl ? 'postgres' : 'stateless',
    secret,
    visibility,
  };
};
