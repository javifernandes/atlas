import { Effect } from 'effect';
import { describe, expect, it, vi } from 'vitest';

import { atlasWorkspaceRef } from '../model/workspace-administration';
import type { ModelProvider } from '@ontahi/core/runtime/server';
import { createAtlasWorkspaceModelProviderResolver } from './model-provider';

const input = { workspace: atlasWorkspaceRef('00000000-0000-4000-8000-000000000137'), question: 'Why?' };

describe('Workspace model provider resolution', () => {
  it('uses the deployment provider when the Workspace has no active connection', async () => {
    const fallback = { generate: vi.fn() } as unknown as ModelProvider;
    const resolver = createAtlasWorkspaceModelProviderResolver({
      fallback,
      pool: { query: vi.fn().mockResolvedValue({ rows: [] }) } as never,
      secretStore: null,
    });

    await expect(Effect.runPromise(resolver(input))).resolves.toBe(fallback);
  });

  it('resolves the credential referenced by the Workspace connection', async () => {
    const get = vi.fn().mockResolvedValue('workspace-key');
    const resolver = createAtlasWorkspaceModelProviderResolver({
      pool: {
        query: vi.fn().mockResolvedValue({
          rows: [{ baseUrl: null, model: 'gpt-test', provider: 'openai', secretRef: 'ATLAS_MODEL_CONNECTION_TEST' }],
        }),
      } as never,
      secretStore: { delete: vi.fn(), get, put: vi.fn() },
    });

    await expect(Effect.runPromise(resolver(input))).resolves.toMatchObject({ generate: expect.any(Function) });
    expect(get).toHaveBeenCalledWith('ATLAS_MODEL_CONNECTION_TEST');
  });
});
