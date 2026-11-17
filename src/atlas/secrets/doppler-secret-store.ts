import {
  AtlasSecretStoreError,
  type AtlasSecretReference,
  type AtlasSecretStore,
} from './secret-store';

export type AtlasDopplerSecretStoreOptions = {
  config: string;
  fetcher?: typeof fetch;
  project: string;
  token: string;
};

const endpoint = 'https://api.doppler.com/v3/configs/config';

export const createAtlasDopplerSecretStore = (
  options: AtlasDopplerSecretStoreOptions,
): AtlasSecretStore => {
  const fetcher = options.fetcher ?? fetch;
  const headers = {
    accept: 'application/json',
    authorization: `Bearer ${options.token}`,
  };
  const query = (reference: AtlasSecretReference) =>
    new URLSearchParams({
      config: options.config,
      name: reference,
      project: options.project,
    });
  const request = async (
    operation: 'delete' | 'get' | 'put',
    input: string,
    init: RequestInit,
  ) => {
    try {
      return await fetcher(input, init);
    } catch {
      throw new AtlasSecretStoreError(operation);
    }
  };

  return {
    async put(reference, value) {
      const response = await request('put', `${endpoint}/secrets`, {
        method: 'POST',
        headers: { ...headers, 'content-type': 'application/json' },
        body: JSON.stringify({
          config: options.config,
          project: options.project,
          secrets: { [reference]: value },
        }),
        cache: 'no-store',
      });
      if (!response.ok) throw new AtlasSecretStoreError('put', response.status);
    },
    async get(reference) {
      const response = await request('get', `${endpoint}/secret?${query(reference)}`, {
        headers,
        cache: 'no-store',
      });
      if (!response.ok) throw new AtlasSecretStoreError('get', response.status);
      const payload = await response.json() as {
        value?: { computed?: unknown };
      };
      const value = payload.value?.computed;
      if (typeof value !== 'string') throw new AtlasSecretStoreError('get', response.status);
      return value;
    },
    async delete(reference) {
      const response = await request('delete', `${endpoint}/secret?${query(reference)}`, {
        method: 'DELETE',
        headers,
        cache: 'no-store',
      });
      if (!response.ok && response.status !== 404) {
        throw new AtlasSecretStoreError('delete', response.status);
      }
    },
  };
};

