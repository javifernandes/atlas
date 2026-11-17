import { Effect } from 'effect';
import { describe, expect, it, vi } from 'vitest';

import { atlasWorkspaceRef } from '../model/workspace-administration';
import type { ModelProvider } from '@ontahi/core/runtime/server';
import {
  createAtlasConfiguredModelProvider,
  createAtlasWorkspaceModelProviderResolver,
  readAtlasModelFallbackConfiguration,
  readAtlasModelConfiguration,
} from './model-provider';

const input = { workspace: atlasWorkspaceRef('00000000-0000-4000-8000-000000000137'), question: 'Why?' };

describe('Workspace model provider resolution', () => {
  it('never enables the deployment fallback in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('ATLAS_LLM_PROVIDER', 'openai');
    vi.stubEnv('ATLAS_LLM_MODEL', 'gpt-test');
    vi.stubEnv('OPENAI_API_KEY', 'secret');

    expect(readAtlasModelConfiguration().enabled).toBe(false);
    vi.unstubAllEnvs();
  });

  it('does not expose the local fallback to persistent Workspaces', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('DATABASE_URL', 'postgres://atlas.test/atlas');
    vi.stubEnv('ATLAS_LLM_PROVIDER', 'openai');
    vi.stubEnv('ATLAS_LLM_MODEL', 'gpt-test');
    vi.stubEnv('OPENAI_API_KEY', 'secret');

    expect(readAtlasModelFallbackConfiguration()).toEqual({
      enabled: false,
      model: null,
      provider: null,
    });
    vi.unstubAllEnvs();
  });

  it('creates the Ontahí DeepSeek adapter for Workspace connections', () => {
    expect(createAtlasConfiguredModelProvider({
      apiKey: 'secret',
      model: 'deepseek-flash',
      provider: 'deepseek',
    })).toMatchObject({ generate: expect.any(Function) });
  });

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
