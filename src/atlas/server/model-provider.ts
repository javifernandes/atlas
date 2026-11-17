import {
  createAnthropicModelProvider,
  createDeepSeekModelProvider,
  createOpenAIModelProvider,
  type ModelProvider,
} from '@ontahi/core/runtime/server';
import type { Pool } from 'pg';
import { Effect } from 'effect';

import type { AtlasPlanAssistantInput } from '../model/plan-assistant';
import { atlasSecretReference, type AtlasSecretStore } from '../secrets/secret-store';
import { getAtlasPostgresPool } from '../../database/postgres-pool';

export type AtlasModelConfiguration = {
  enabled: boolean;
  model: string | null;
  provider: 'anthropic' | 'deepseek' | 'openai' | null;
};

export const readAtlasModelConfiguration = (): AtlasModelConfiguration => {
  const model = process.env.ATLAS_LLM_MODEL?.trim() || null;
  const configuredProvider = process.env.ATLAS_LLM_PROVIDER?.trim().toLowerCase();
  const provider =
    configuredProvider === 'openai' || configuredProvider === 'anthropic' || configuredProvider === 'deepseek'
      ? configuredProvider
      : null;
  const credential =
    provider === 'openai'
      ? process.env.OPENAI_API_KEY
      : provider === 'anthropic'
        ? process.env.ANTHROPIC_API_KEY
        : provider === 'deepseek'
          ? process.env.DEEPSEEK_API_KEY
          : null;

  return {
    enabled: process.env.NODE_ENV !== 'production' && Boolean(model && provider && credential),
    model,
    provider,
  };
};

export const createAtlasModelProvider = (): ModelProvider | null => {
  const configuration = readAtlasModelConfiguration();
  if (!configuration.enabled || !configuration.model || !configuration.provider) return null;

  return createAtlasConfiguredModelProvider({
    apiKey:
      configuration.provider === 'openai'
        ? process.env.OPENAI_API_KEY ?? ''
        : configuration.provider === 'anthropic'
          ? process.env.ANTHROPIC_API_KEY ?? ''
          : process.env.DEEPSEEK_API_KEY ?? '',
    baseUrl: process.env.ATLAS_LLM_URL?.trim() || undefined,
    model: configuration.model,
    provider: configuration.provider,
  });
};

export const createAtlasConfiguredModelProvider = (configuration: {
  apiKey: string;
  baseUrl?: string;
  model: string;
  provider: 'anthropic' | 'deepseek' | 'openai';
}): ModelProvider => {
  const common = {
    apiKey: configuration.apiKey,
    baseUrl: configuration.baseUrl,
    model: configuration.model,
    maxOutputTokens: 1200,
  };
  if (configuration.provider === 'openai') {
    return createOpenAIModelProvider(common);
  }
  if (configuration.provider === 'deepseek') {
    return createDeepSeekModelProvider(common);
  }
  return createAnthropicModelProvider(common);
};

type AtlasWorkspaceModelConnectionRow = {
  baseUrl: string | null;
  model: string;
  provider: 'anthropic' | 'deepseek' | 'openai';
  secretRef: string;
};

export const createAtlasWorkspaceModelProviderResolver = (input: {
  fallback?: ModelProvider | null;
  pool: Pick<Pool, 'query'>;
  secretStore: AtlasSecretStore | null;
}) => (operationInput: AtlasPlanAssistantInput) =>
  Effect.gen(function* () {
    const workspaceId = String(operationInput.workspace.locator.id);
    const result = yield* Effect.tryPromise({
      try: () => input.pool.query<AtlasWorkspaceModelConnectionRow>(
        `
          SELECT
            base_url AS "baseUrl",
            model,
            provider,
            secret_ref AS "secretRef"
          FROM atlas_workspace_model_connections
          WHERE workspace_id = $1
            AND purpose = 'plans-assistant'
            AND status = 'active'
          LIMIT 1
        `,
        [workspaceId],
      ),
      catch: () => ({
        reason: 'assistant_configuration_failed',
        message: 'The Workspace model configuration could not be loaded.',
      }),
    });
    const connection = result.rows[0];
    if (!connection) {
      if (input.fallback) return input.fallback;
      return yield* Effect.fail({
        reason: 'assistant_unavailable',
        message: 'The Atlas Plan assistant is not configured.',
      });
    }
    if (!input.secretStore) {
      return yield* Effect.fail({
        reason: 'assistant_secret_store_unavailable',
        message: 'Workspace model credentials are temporarily unavailable.',
      });
    }
    const apiKey = yield* Effect.tryPromise({
      try: () => input.secretStore!.get(atlasSecretReference(connection.secretRef)),
      catch: () => ({
        reason: 'assistant_credential_unavailable',
        message: 'The Workspace model credential could not be resolved.',
      }),
    });
    return createAtlasConfiguredModelProvider({
      apiKey,
      ...(connection.baseUrl ? { baseUrl: connection.baseUrl } : {}),
      model: connection.model,
      provider: connection.provider,
    });
  });

export const hasAtlasWorkspaceModelProvider = async (workspaceId: string) => {
  if (readAtlasModelConfiguration().enabled) return true;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return false;
  const result = await getAtlasPostgresPool(connectionString).query<{ configured: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM atlas_workspace_model_connections
        WHERE workspace_id = $1
          AND purpose = 'plans-assistant'
          AND status = 'active'
      ) AS configured
    `,
    [workspaceId],
  );
  return result.rows[0]?.configured === true;
};
