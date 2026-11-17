import { describe, expect, it, vi } from 'vitest';

import { listAtlasProviderModels } from './model-catalog';

describe('provider model catalog', () => {
  it('authenticates DeepSeek discovery and returns sorted model options', async () => {
    const fetchRequest = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: [
        { id: 'deepseek-v4-pro' },
        { id: 'deepseek-flash', name: 'DeepSeek Flash' },
      ],
    })));

    await expect(listAtlasProviderModels({
      apiKey: 'secret',
      fetchRequest,
      provider: 'deepseek',
    })).resolves.toEqual([
      { id: 'deepseek-flash', label: 'deepseek-flash' },
      { id: 'deepseek-v4-pro', label: 'deepseek-v4-pro' },
    ]);
    expect(fetchRequest).toHaveBeenCalledWith(
      'https://api.deepseek.com/models',
      expect.objectContaining({ headers: { authorization: 'Bearer secret' } }),
    );
  });

  it('filters OpenAI models that cannot back the text assistant', async () => {
    const fetchRequest = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: [{ id: 'gpt-6-luna' }, { id: 'text-embedding-3-small' }],
    })));

    await expect(listAtlasProviderModels({
      apiKey: 'secret',
      fetchRequest,
      provider: 'openai',
    })).resolves.toEqual([{ id: 'gpt-6-luna', label: 'gpt-6-luna' }]);
  });
});
