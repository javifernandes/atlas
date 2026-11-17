import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { WorkspaceModelSettings } from './workspace-model-settings';

const fetchMock = vi.fn();

describe('WorkspaceModelSettings', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset().mockResolvedValue(new Response(JSON.stringify({
      connection: null,
      deploymentFallback: { enabled: false, model: null, provider: null },
      secretStore: { available: true, provider: 'doppler' },
    }), { status: 200 }));
  });

  it('configures a Workspace model without rendering the submitted credential', async () => {
    render(<WorkspaceModelSettings canManage workspaceSlug='atlas' />);
    await screen.findByLabelText('Provider');

    fireEvent.change(screen.getByLabelText('Model'), { target: { value: 'gpt-test' } });
    fireEvent.change(screen.getByLabelText('API key'), {
      target: { value: 'provider-secret-key' },
    });
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      connection: {
        baseUrl: null,
        model: 'gpt-test',
        provider: 'openai',
        secretSuffix: '-key',
        status: 'active',
      },
      deploymentFallback: { enabled: false, model: null, provider: null },
      secretStore: { available: true, provider: 'doppler' },
    }), { status: 200 }));
    fireEvent.click(screen.getByRole('button', { name: 'Save connection' }));

    await screen.findByText('Workspace model connection saved.');
    const request = fetchMock.mock.calls[1]!;
    expect(request[0]).toBe('/api/workspaces/atlas/model-connection');
    expect(JSON.parse(request[1].body)).toMatchObject({
      apiKey: 'provider-secret-key',
      model: 'gpt-test',
      provider: 'openai',
    });
    expect(screen.queryByText('provider-secret-key')).not.toBeInTheDocument();
    expect(screen.getByLabelText('API key')).toHaveValue('');
  });

  it('lets the owner reveal and hide the API key while entering it', async () => {
    render(<WorkspaceModelSettings canManage workspaceSlug='atlas' />);
    const apiKey = await screen.findByLabelText('API key');

    expect(apiKey).toHaveAttribute('type', 'password');
    fireEvent.change(apiKey, { target: { value: 'provider-secret-key' } });
    fireEvent.click(screen.getByRole('button', { name: 'Show API key' }));
    expect(apiKey).toHaveAttribute('type', 'text');

    fireEvent.click(screen.getByRole('button', { name: 'Hide API key' }));
    expect(apiKey).toHaveAttribute('type', 'password');
  });

  it('discovers provider models and applies the selected model ID', async () => {
    render(<WorkspaceModelSettings canManage workspaceSlug='atlas' />);
    const apiKey = await screen.findByLabelText('API key');
    fireEvent.change(apiKey, { target: { value: 'provider-secret-key' } });
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      models: [
        { id: 'gpt-6-luna', label: 'GPT-6 Luna' },
        { id: 'gpt-6.1-sol', label: 'GPT-6.1 Sol' },
      ],
    })));

    fireEvent.click(screen.getByRole('button', { name: 'Find available models' }));

    await screen.findByText('2 available models found.');
    expect(screen.getByLabelText('Model')).toHaveValue('gpt-6-luna');
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ method: 'POST' });
    expect(JSON.parse(fetchMock.mock.calls[1]?.[1].body)).toEqual({
      apiKey: 'provider-secret-key',
      provider: 'openai',
    });
  });

  it('explains when confidential Workspace storage is unavailable', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      connection: null,
      deploymentFallback: { enabled: true, model: 'fallback', provider: 'openai' },
      secretStore: { available: false, provider: null },
    }), { status: 200 }));
    render(<WorkspaceModelSettings canManage workspaceSlug='atlas' />);

    await waitFor(() => expect(screen.getByText(/credential storage is unavailable/i)).toBeInTheDocument());
    expect(screen.getByText(/Local development model: openai · fallback/)).toBeInTheDocument();
    expect(screen.queryByLabelText('API key')).not.toBeInTheDocument();
  });
});
