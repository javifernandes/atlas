export type AtlasSecretReference = string & { readonly __atlasSecretReference: unique symbol };

export type AtlasSecretStore = {
  delete(reference: AtlasSecretReference): Promise<void>;
  get(reference: AtlasSecretReference): Promise<string>;
  put(reference: AtlasSecretReference, value: string): Promise<void>;
};

export class AtlasSecretStoreError extends Error {
  readonly code = 'atlas_secret_store_failed';

  constructor(
    readonly operation: 'delete' | 'get' | 'put',
    readonly status?: number,
  ) {
    super('The configured secret store could not complete the request.');
    this.name = 'AtlasSecretStoreError';
  }
}

export const atlasSecretReference = (value: string): AtlasSecretReference => {
  if (!/^[A-Z][A-Z0-9_]{2,127}$/.test(value)) {
    throw new Error('Atlas secret references must be stable uppercase identifiers.');
  }
  return value as AtlasSecretReference;
};
