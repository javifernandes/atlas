'use client';

import { CircleAlert, CircleCheck, Eye, EyeOff, Info } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Select } from '@/components/ui/select';

type ModelConnectionView = {
  connections: Array<{
    id: string;
    baseUrl: string | null;
    model: string;
    provider: 'anthropic' | 'deepseek' | 'openai';
    secretSuffix: string | null;
    status: 'active' | 'disabled';
  }>;
  deploymentFallback: {
    enabled: boolean;
    model: string | null;
    provider: 'anthropic' | 'deepseek' | 'openai' | null;
  };
  secretStore: {
    available: boolean;
    provider: 'doppler' | null;
  };
};

type Feedback = {
  text: string;
  tone: 'error' | 'info' | 'success';
};

export const WorkspaceModelSettings = ({
  canManage,
  workspaceSlug,
}: {
  canManage: boolean;
  workspaceSlug: string;
}) => {
  const [view, setView] = useState<ModelConnectionView | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [provider, setProvider] = useState<'anthropic' | 'deepseek' | 'openai'>('openai');
  const [model, setModel] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [editingConnection, setEditingConnection] = useState(false);
  const [availableModels, setAvailableModels] = useState<Array<{ id: string; label: string }>>([]);
  const endpoint = `/api/workspaces/${encodeURIComponent(workspaceSlug)}/model-connection`;

  const load = async () => {
    setLoading(true);
    try {
      const response = await fetch(endpoint, { cache: 'no-store' });
      const payload = await response.json() as ModelConnectionView & { message?: string };
      if (!response.ok) throw new Error(payload.message ?? 'Model settings could not be loaded.');
      setView(payload);
    } catch (error) {
      setFeedback({
        text: error instanceof Error ? error.message : 'Model settings could not be loaded.',
        tone: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [workspaceSlug]);

  const save = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      const response = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ apiKey, baseUrl, model, provider }),
      });
      const payload = await response.json() as ModelConnectionView & { message?: string };
      if (!response.ok) throw new Error(payload.message ?? 'The model connection could not be saved.');
      setView(payload);
      setApiKey('');
      setAvailableModels([]);
      setEditingConnection(false);
      setFeedback({
        text: 'Connected. Ask Atlas is now available in this Workspace.',
        tone: 'success',
      });
    } catch (error) {
      setFeedback({
        text: error instanceof Error ? error.message : 'The model connection could not be saved.',
        tone: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  const loadModels = async () => {
    if (apiKey.trim().length < 8) return;
    setLoadingModels(true);
    setFeedback(null);
    setAvailableModels([]);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ apiKey, provider }),
      });
      const payload = await response.json() as {
        message?: string;
        models?: Array<{ id: string; label: string }>;
      };
      if (!response.ok) throw new Error(payload.message ?? 'Models could not be loaded.');
      const models = payload.models ?? [];
      setAvailableModels(models);
      setModel('');
      setFeedback(models.length > 0
        ? { text: 'API key verified. Choose a model to finish connecting.', tone: 'info' }
        : { text: 'No compatible models were returned for this API key.', tone: 'error' });
    } catch (error) {
      setFeedback({
        text: error instanceof Error ? error.message : 'Models could not be loaded.',
        tone: 'error',
      });
    } finally {
      setLoadingModels(false);
    }
  };

  const selectConnection = async (connectionId: string) => {
    setSaving(true);
    setFeedback(null);
    try {
      const response = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ connectionId }),
      });
      const payload = await response.json() as ModelConnectionView & { message?: string };
      if (!response.ok) throw new Error(payload.message ?? 'The model connection could not be selected.');
      setView(payload);
      setFeedback({ text: 'Active model connection updated.', tone: 'success' });
    } catch (error) {
      setFeedback({
        text: error instanceof Error ? error.message : 'The model connection could not be selected.',
        tone: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  const deleteConnection = async (connectionId: string) => {
    setSaving(true);
    setFeedback(null);
    try {
      const response = await fetch(endpoint, {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ connectionId }),
      });
      const payload = await response.json() as ModelConnectionView & { message?: string };
      if (!response.ok) throw new Error(payload.message ?? 'The model connection could not be deleted.');
      setView(payload);
      setEditingConnection(payload.connections.length === 0);
      setFeedback({ text: 'Model connection deleted.', tone: 'success' });
    } catch (error) {
      setFeedback({
        text: error instanceof Error ? error.message : 'The model connection could not be deleted.',
        tone: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  const editConnection = (connection?: ModelConnectionView['connections'][number]) => {
    setProvider(connection?.provider ?? 'openai');
    setModel(connection?.model ?? '');
    setBaseUrl(connection?.baseUrl ?? '');
    setApiKey('');
    setAvailableModels([]);
    setEditingConnection(true);
    setFeedback(null);
  };

  return (
    <section className='grid gap-6' id='models'>
      <div>
        <h2 className='text-xl font-medium'>Models</h2>
        <p className='text-sm text-muted-foreground'>
          Connect an AI provider to use Atlas's intelligent features in this Workspace.
        </p>
      </div>

      {loading ? <p className='text-sm text-muted-foreground'>Loading model connection…</p> : null}

      {view?.connections.map(connection => (
        <div className={`grid gap-2 rounded-lg border p-4 ${connection.status === 'active' ? 'border-cyan-500/50 bg-cyan-500/5' : 'border-border'}`} key={connection.id}>
          <div className='flex flex-wrap items-center justify-between gap-3'>
            <div>
              <div className='flex items-center gap-2'>
                <p className='font-medium'>{connection.provider} · {connection.model}</p>
                {connection.status === 'active' ? (
                  <span className='rounded-full bg-cyan-500/15 px-2 py-0.5 text-xs font-medium text-cyan-700 dark:text-cyan-300'>Active</span>
                ) : null}
              </div>
              <p className='text-xs text-muted-foreground'>
                {connection.secretSuffix
                  ? `Credential securely stored · ending ${connection.secretSuffix}`
                  : 'Credential securely stored'}
              </p>
            </div>
            {canManage ? (
              <div className='flex items-center gap-2'>
                {connection.status !== 'active' ? (
                  <button className='rounded-md border border-border px-3 py-2 text-sm hover:bg-muted' disabled={saving} onClick={() => void selectConnection(connection.id)} type='button'>Use</button>
                ) : null}
                <button className='rounded-md border border-border px-3 py-2 text-sm hover:bg-muted' disabled={saving} onClick={() => editConnection(connection)} type='button'>Edit</button>
                <button className='rounded-md border border-red-500/40 px-3 py-2 text-sm text-red-700 hover:bg-red-500/10 dark:text-red-300' disabled={saving} onClick={() => void deleteConnection(connection.id)} type='button'>Delete</button>
              </div>
            ) : null}
          </div>
          {connection.baseUrl ? <p className='break-all text-xs text-muted-foreground'>{connection.baseUrl}</p> : null}
        </div>
      ))}

      {canManage && view?.secretStore.available && view.connections.length > 0 && !editingConnection ? (
        <div><button className='rounded-md border border-border px-3 py-2 text-sm hover:bg-muted' onClick={() => editConnection()} type='button'>Add provider</button></div>
      ) : null}

      {view?.deploymentFallback.enabled ? (
        <p className='rounded-md border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground'>
          Local development model: {view.deploymentFallback.provider} · {view.deploymentFallback.model}
        </p>
      ) : null}

      {!loading && view && !view.secretStore.available ? (
        <p className='rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm'>
          Workspace credential storage is unavailable on this Atlas host. Existing deployment
          configuration remains unchanged.
        </p>
      ) : null}

      {canManage && view?.secretStore.available && (view.connections.length === 0 || editingConnection) ? (
        <div className='grid gap-4 rounded-lg border border-border p-4'>
          <Select
            label='Provider'
            onChange={nextProvider => {
              setProvider(nextProvider);
              setApiKey('');
              setAvailableModels([]);
              setModel('');
            }}
            options={[
              { label: 'OpenAI', value: 'openai' },
              { label: 'Anthropic', value: 'anthropic' },
              { label: 'DeepSeek', value: 'deepseek' },
            ]}
            value={provider}
          />
          <label className='grid gap-1 text-sm' htmlFor='workspace-model-api-key'>
            API key
            <span className='relative'>
              <input
                aria-label='API key'
                autoComplete='off'
                className='h-10 w-full rounded-md border border-input bg-background px-3 pr-10'
                id='workspace-model-api-key'
                onBlur={() => void loadModels()}
                onChange={event => {
                  setApiKey(event.target.value);
                  setAvailableModels([]);
                  setModel('');
                }}
                placeholder={view.connections.some(connection => connection.provider === provider) ? 'Enter a new key to replace the credential' : 'Provider API key'}
                type={showApiKey ? 'text' : 'password'}
                value={apiKey}
              />
              <button
                aria-label={showApiKey ? 'Hide API key' : 'Show API key'}
                className='absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30'
                onClick={() => setShowApiKey(current => !current)}
                type='button'
              >
                {showApiKey ? <EyeOff className='size-4' /> : <Eye className='size-4' />}
              </button>
            </span>
            <span className='text-xs text-muted-foreground'>
              Atlas validates the key and loads its available models when you leave this field.
            </span>
          </label>
          <Select
            disabled={availableModels.length === 0}
            label='Model'
            onChange={setModel}
            options={availableModels.length > 0 && model
              ? availableModels.map(available => ({
                label: available.label,
                value: available.id,
              }))
              : [{
                  label: loadingModels
                    ? 'Loading models…'
                    : availableModels.length > 0
                      ? 'Choose a model'
                      : 'Enter a valid API key first',
                  value: '',
                }, ...availableModels.map(available => ({
                  label: available.label,
                  value: available.id,
                }))]}
            value={model}
          />
          <details className='rounded-md border border-border px-3 py-2'>
            <summary className='cursor-pointer text-sm text-muted-foreground'>Advanced</summary>
            <label className='mt-3 grid gap-1 text-sm'>
              Base URL <span className='text-xs text-muted-foreground'>(optional)</span>
              <input
                className='h-10 rounded-md border border-input bg-background px-3'
                onChange={event => setBaseUrl(event.target.value)}
                placeholder={provider === 'openai'
                  ? 'https://api.openai.com/v1'
                  : provider === 'anthropic'
                    ? 'https://api.anthropic.com/v1'
                    : 'https://api.deepseek.com'}
                value={baseUrl}
              />
            </label>
          </details>
          <div>
            <button
              className='h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50'
              disabled={saving || !model || apiKey.trim().length < 8}
              onClick={() => void save()}
              type='button'
            >
              {saving ? 'Saving…' : view.connections.some(connection => connection.provider === provider) ? 'Replace connection' : 'Save connection'}
            </button>
          </div>
        </div>
      ) : null}

      {feedback ? (
        <div
          className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm ${
            feedback.tone === 'error'
              ? 'border-red-500/50 bg-red-500/10 text-red-700 dark:text-red-300'
              : feedback.tone === 'success'
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                : 'border-cyan-500/40 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300'
          }`}
          role={feedback.tone === 'error' ? 'alert' : 'status'}
        >
          {feedback.tone === 'error' ? (
            <CircleAlert className='mt-0.5 size-4 shrink-0' />
          ) : feedback.tone === 'success' ? (
            <CircleCheck className='mt-0.5 size-4 shrink-0' />
          ) : (
            <Info className='mt-0.5 size-4 shrink-0' />
          )}
          <span className='font-medium'>{feedback.text}</span>
        </div>
      ) : null}
    </section>
  );
};
