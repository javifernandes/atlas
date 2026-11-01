import {
  createAnthropicModelProvider,
  createOpenAIModelProvider,
  type ModelProvider,
} from '@ontahi/core/runtime/server';

export type AtlasModelConfiguration = {
  enabled: boolean;
  model: string | null;
  provider: 'anthropic' | 'openai' | null;
};

export const readAtlasModelConfiguration = (): AtlasModelConfiguration => {
  const model = process.env.ATLAS_LLM_MODEL?.trim() || null;
  const configuredProvider = process.env.ATLAS_LLM_PROVIDER?.trim().toLowerCase();
  const provider =
    configuredProvider === 'openai' || configuredProvider === 'anthropic'
      ? configuredProvider
      : null;
  const credential =
    provider === 'openai'
      ? process.env.OPENAI_API_KEY
      : provider === 'anthropic'
        ? process.env.ANTHROPIC_API_KEY
        : null;

  return { enabled: Boolean(model && provider && credential), model, provider };
};

export const createAtlasModelProvider = (): ModelProvider | null => {
  const configuration = readAtlasModelConfiguration();
  if (!configuration.enabled || !configuration.model || !configuration.provider) return null;

  const baseUrl = process.env.ATLAS_LLM_URL?.trim() || undefined;
  return configuration.provider === 'openai'
    ? createOpenAIModelProvider({
        apiKey: process.env.OPENAI_API_KEY ?? '',
        baseUrl,
        model: configuration.model,
        maxOutputTokens: 1200,
      })
    : createAnthropicModelProvider({
        apiKey: process.env.ANTHROPIC_API_KEY ?? '',
        baseUrl,
        model: configuration.model,
        maxOutputTokens: 1200,
      });
};
