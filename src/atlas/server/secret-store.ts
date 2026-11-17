import { createAtlasDopplerSecretStore } from '../secrets/doppler-secret-store';
import type { AtlasSecretStore } from '../secrets/secret-store';

export type AtlasSecretStoreConfiguration = {
  available: boolean;
  config: string | null;
  project: string | null;
  provider: 'doppler' | null;
};

export const readAtlasSecretStoreConfiguration = (
  environment: Record<string, string | undefined> = process.env,
): AtlasSecretStoreConfiguration => {
  const token = environment.ATLAS_DOPPLER_TOKEN?.trim() || null;
  const project = environment.ATLAS_DOPPLER_PROJECT?.trim() || null;
  const config = environment.ATLAS_DOPPLER_CONFIG?.trim() || null;

  return {
    available: Boolean(token && project && config),
    config,
    project,
    provider: token || project || config ? 'doppler' : null,
  };
};

export const createAtlasSecretStore = (
  environment: Record<string, string | undefined> = process.env,
  fetcher?: typeof fetch,
): AtlasSecretStore | null => {
  const configuration = readAtlasSecretStoreConfiguration(environment);
  const token = environment.ATLAS_DOPPLER_TOKEN?.trim();
  if (
    !configuration.available ||
    !configuration.project ||
    !configuration.config ||
    !token
  ) return null;

  return createAtlasDopplerSecretStore({
    config: configuration.config,
    ...(fetcher ? { fetcher } : {}),
    project: configuration.project,
    token,
  });
};

