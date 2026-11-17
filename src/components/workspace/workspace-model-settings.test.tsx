import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { WorkspaceModelSettings } from './workspace-model-settings';

const fetchMock = vi.fn();

describe('WorkspaceModelSettings', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset().mockResolvedValue(new Response(JSON.stringify({
      connections: [],
      deploymentFallback: { enabled: false, model: null, provider: null },
      secretStore: { available: true, provider: 'doppler' },
    }), { status: 200 }));
  });

  it('configures a Workspace model without rendering the submitted credential', async () => {
    render(<WorkspaceModelSettings canManage workspaceSlug='atlas' />);
    await screen.findByLabelText('Provider');

    const apiKey = screen.getByLabelText('API key');
    fireEvent.change(apiKey, {
      target: { value: 'provider-secret-key' },
    });
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      models: [{ id: 'gpt-test', label: 'GPT Test' }],
    })));
    fireEvent.blur(apiKey);
    await screen.findByText('API key verified. Choose a model to finish connecting.');
    fireEvent.click(screen.getByLabelText('Model'));
    fireEvent.click(screen.getByRole('option', { name: 'GPT Test' }));

    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      connections: [{
        id: '00000000-0000-4000-8000-000000000201',
        baseUrl: null,
        model: 'gpt-test',
        provider: 'openai',
        secretSuffix: '-key',
        status: 'active',
      }],
      deploymentFallback: { enabled: false, model: null, provider: null },
      secretStore: { available: true, provider: 'doppler' },
    }), { status: 200 }));
    fireEvent.click(screen.getByRole('button', { name: 'Save connection' }));

    await screen.findByText('Connected. Ask Atlas is now available in this Workspace.');
    const request = fetchMock.mock.calls[2]!;
    expect(request[0]).toBe('/api/workspaces/atlas/model-connection');
    expect(JSON.parse(request[1].body)).toMatchObject({
      apiKey: 'provider-secret-key',
      model: 'gpt-test',
      provider: 'openai',
    });
    expect(screen.queryByText('provider-secret-key')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('API key')).not.toBeInTheDocument();
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

    fireEvent.blur(apiKey);

    await screen.findByText('API key verified. Choose a model to finish connecting.');
    expect(screen.getByLabelText('Model')).toHaveTextContent('Choose a model');
    fireEvent.click(screen.getByLabelText('Model'));
    fireEvent.click(screen.getByRole('option', { name: 'GPT-6 Luna' }));
    expect(screen.getByLabelText('Model')).toHaveTextContent('GPT-6 Luna');
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ method: 'POST' });
    expect(JSON.parse(fetchMock.mock.calls[1]?.[1].body)).toEqual({
      apiKey: 'provider-secret-key',
      provider: 'openai',
    });
  });

  it('explains when confidential Workspace storage is unavailable', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      connections: [],
      deploymentFallback: { enabled: true, model: 'fallback', provider: 'openai' },
      secretStore: { available: false, provider: null },
    }), { status: 200 }));
    render(<WorkspaceModelSettings canManage workspaceSlug='atlas' />);

    await waitFor(() => expect(screen.getByText(/credential storage is unavailable/i)).toBeInTheDocument());
    expect(screen.getByText(/Local development model: openai · fallback/)).toBeInTheDocument();
    expect(screen.queryByLabelText('API key')).not.toBeInTheDocument();
  });

  it('renders loading failures as prominent alerts', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      message: 'Model settings exploded.',
    }), { status: 500 }));

    render(<WorkspaceModelSettings canManage workspaceSlug='atlas' />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Model settings exploded.');
    expect(alert).toHaveClass('border-red-500/50');
  });

  it('keeps replacement credentials hidden behind an explicit action', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      connections: [{
        id: '00000000-0000-4000-8000-000000000201',
        baseUrl: null,
        model: 'deepseek-flash',
        provider: 'deepseek',
        secretSuffix: '63e0',
        status: 'active',
      }],
      deploymentFallback: { enabled: false, model: null, provider: null },
      secretStore: { available: true, provider: 'doppler' },
    })));

    render(<WorkspaceModelSettings canManage workspaceSlug='atlas' />);

    await screen.findByText(/credential securely stored · ending 63e0/i);
    expect(screen.queryByLabelText('API key')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(screen.getByLabelText('API key')).toBeInTheDocument();
  });

  it('selects and deletes saved provider connections', async () => {
    const connections = [
      {
        id: '00000000-0000-4000-8000-000000000201',
        baseUrl: null,
        model: 'deepseek-flash',
        provider: 'deepseek',
        secretSuffix: '63e0',
        status: 'active',
      },
      {
        id: '00000000-0000-4000-8000-000000000202',
        baseUrl: null,
        model: 'gpt-test',
        provider: 'openai',
        secretSuffix: 'test',
        status: 'disabled',
      },
    ];
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      connections,
      deploymentFallback: { enabled: false, model: null, provider: null },
      secretStore: { available: true, provider: 'doppler' },
    })));
    render(<WorkspaceModelSettings canManage workspaceSlug='atlas' />);
    await screen.findByText('openai · gpt-test');

    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      connections: connections.map(connection => ({
        ...connection,
        status: connection.provider === 'openai' ? 'active' : 'disabled',
      })),
      deploymentFallback: { enabled: false, model: null, provider: null },
      secretStore: { available: true, provider: 'doppler' },
    })));
    fireEvent.click(screen.getByRole('button', { name: 'Use' }));
    await screen.findByText('Active model connection updated.');
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ method: 'PATCH' });

    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      connections: [connections[1]],
      deploymentFallback: { enabled: false, model: null, provider: null },
      secretStore: { available: true, provider: 'doppler' },
    })));
    fireEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0]!);
    await screen.findByText('Model connection deleted.');
    expect(fetchMock.mock.calls[2]?.[1]).toMatchObject({ method: 'DELETE' });
  });
});
