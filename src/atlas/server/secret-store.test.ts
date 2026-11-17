import { describe, expect, it, vi } from 'vitest';

import { atlasSecretReference } from '../secrets/secret-store';
import {
  createAtlasSecretStore,
  readAtlasSecretStoreConfiguration,
} from './secret-store';

describe('Atlas secret store configuration', () => {
  it('stays unavailable until the complete server-only Doppler binding exists', () => {
    expect(readAtlasSecretStoreConfiguration({})).toEqual({
      available: false,
      config: null,
      project: null,
      provider: null,
    });
    expect(readAtlasSecretStoreConfiguration({ ATLAS_DOPPLER_TOKEN: 'token' })).toEqual({
      available: false,
      config: null,
      project: null,
      provider: 'doppler',
    });
  });

  it('creates the Doppler adapter only from complete host configuration', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    const environment = {
      ATLAS_DOPPLER_CONFIG: 'dev',
      ATLAS_DOPPLER_PROJECT: 'atlas',
      ATLAS_DOPPLER_TOKEN: 'service-token',
    };

    const store = createAtlasSecretStore(environment, fetcher);
    expect(store).not.toBeNull();
    await store!.put(atlasSecretReference('ATLAS_MODEL_CONNECTION_TEST'), 'provider-key');
    expect(fetcher).toHaveBeenCalledOnce();
  });
});
