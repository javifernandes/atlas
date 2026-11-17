import { describe, expect, it, vi } from 'vitest';

import { createAtlasDopplerSecretStore } from './doppler-secret-store';
import { AtlasSecretStoreError, atlasSecretReference } from './secret-store';

const reference = atlasSecretReference('ATLAS_MODEL_CONNECTION_TEST');

describe('Atlas Doppler secret store', () => {
  it('writes a secret into the configured project and config', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    const store = createAtlasDopplerSecretStore({
      config: 'dev',
      fetcher,
      project: 'atlas',
      token: 'service-token',
    });

    await store.put(reference, 'provider-key');

    const [url, init] = fetcher.mock.calls[0]!;
    expect(url).toBe('https://api.doppler.com/v3/configs/config/secrets');
    expect(init).toMatchObject({ method: 'POST', cache: 'no-store' });
    expect(init.headers.authorization).toBe('Bearer service-token');
    expect(JSON.parse(init.body)).toEqual({
      config: 'dev',
      project: 'atlas',
      secrets: { ATLAS_MODEL_CONNECTION_TEST: 'provider-key' },
    });
  });

  it('reads only the requested computed secret', async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({
      name: 'ATLAS_MODEL_CONNECTION_TEST',
      value: { computed: 'provider-key' },
    }));
    const store = createAtlasDopplerSecretStore({
      config: 'dev',
      fetcher,
      project: 'atlas',
      token: 'service-token',
    });

    await expect(store.get(reference)).resolves.toBe('provider-key');
    expect(fetcher.mock.calls[0]![0]).toContain(
      '/secret?config=dev&name=ATLAS_MODEL_CONNECTION_TEST&project=atlas',
    );
  });

  it('deletes idempotently when Doppler reports a missing secret', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 404 }));
    const store = createAtlasDopplerSecretStore({
      config: 'dev',
      fetcher,
      project: 'atlas',
      token: 'service-token',
    });

    await expect(store.delete(reference)).resolves.toBeUndefined();
    expect(fetcher.mock.calls[0]![1]).toMatchObject({ method: 'DELETE' });
  });

  it('returns a non-secret typed failure for provider errors', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('credential leaked here', { status: 403 }));
    const store = createAtlasDopplerSecretStore({
      config: 'dev',
      fetcher,
      project: 'atlas',
      token: 'service-token',
    });

    const error = await store.get(reference).catch(value => value);
    expect(error).toBeInstanceOf(AtlasSecretStoreError);
    expect(error).toMatchObject({ operation: 'get', status: 403 });
    expect(String(error)).not.toContain('credential leaked here');
  });
});

