export type AtlasModelProviderName = 'anthropic' | 'deepseek' | 'openai';

type ProviderModel = { id: string; label: string };

const providerCatalogUrl: Record<AtlasModelProviderName, string> = {
  anthropic: 'https://api.anthropic.com/v1/models?limit=1000&lifecycle=active',
  deepseek: 'https://api.deepseek.com/models',
  openai: 'https://api.openai.com/v1/models',
};

const unsuitableOpenAIModel =
  /(?:audio|embedding|image|moderation|realtime|search|transcri|tts|whisper)/i;

export const listAtlasProviderModels = async (input: {
  apiKey: string;
  fetchRequest?: typeof fetch;
  provider: AtlasModelProviderName;
}): Promise<ProviderModel[]> => {
  const fetchRequest = input.fetchRequest ?? globalThis.fetch;
  const response = await fetchRequest(providerCatalogUrl[input.provider], {
    headers: input.provider === 'anthropic'
      ? { 'anthropic-version': '2023-06-01', 'x-api-key': input.apiKey }
      : { authorization: `Bearer ${input.apiKey}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw new Error(`The provider returned HTTP ${response.status}.`);
  }
  const payload = await response.json() as {
    data?: Array<{ display_name?: unknown; id?: unknown; lifecycle?: unknown }>;
  };
  return (payload.data ?? [])
    .filter(item => typeof item.id === 'string')
    .filter(item => input.provider !== 'anthropic' || item.lifecycle !== 'retired')
    .filter(item => input.provider !== 'openai' || !unsuitableOpenAIModel.test(String(item.id)))
    .map(item => ({
      id: String(item.id),
      label: typeof item.display_name === 'string' ? item.display_name : String(item.id),
    }))
    .sort((left, right) => left.label.localeCompare(right.label));
};
