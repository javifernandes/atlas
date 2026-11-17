'use client';

import { CircleAlert, CircleCheck, Eye, EyeOff, Info } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Select } from '@/components/ui/select';

type ModelConnectionView = {
  connection: null | {
    baseUrl: string | null;
    model: string;
    provider: 'anthropic' | 'deepseek' | 'openai';
    secretSuffix: string | null;
    status: 'active' | 'disabled';
  };
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
      if (payload.connection) {
        setProvider(payload.connection.provider);
        setModel(payload.connection.model);
        setBaseUrl(payload.connection.baseUrl ?? '');
      }
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

  const disable = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      const response = await fetch(endpoint, { method: 'DELETE' });
      const payload = await response.json() as ModelConnectionView & { message?: string };
      if (!response.ok) throw new Error(payload.message ?? 'The model connection could not be disabled.');
      setView(payload);
      setFeedback({ text: 'Workspace model connection disabled.', tone: 'success' });
    } catch (error) {
      setFeedback({
        text: error instanceof Error ? error.message : 'The model connection could not be disabled.',
        tone: 'error',
      });
    } finally {
      setSaving(false);
    }
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

      {view?.connection ? (
        <div className='grid gap-2 rounded-lg border border-border p-4'>
          <div className='flex flex-wrap items-center justify-between gap-3'>
            <div>
              <p className='font-medium'>{view.connection.provider} · {view.connection.model}</p>
              <p className='text-xs text-muted-foreground'>
                {view.connection.status}
                {view.connection.secretSuffix
                  ? ` · credential securely stored · ending ${view.connection.secretSuffix}`
                  : ''}
              </p>
            </div>
            {canManage ? (
              <div className='flex items-center gap-2'>
                <button
                  className='rounded-md border border-border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50'
                  disabled={saving}
                  onClick={() => setEditingConnection(true)}
                  type='button'
                >
                  {view.connection.status === 'active' ? 'Replace' : 'Configure'}
                </button>
                {view.connection.status === 'active' ? (
                  <button
                    className='rounded-md border border-border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50'
                    disabled={saving}
                    onClick={() => void disable()}
                    type='button'
                  >
                    Disable
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
          {view.connection.baseUrl ? (
            <p className='break-all text-xs text-muted-foreground'>{view.connection.baseUrl}</p>
          ) : null}
        </div>
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

      {canManage && view?.secretStore.available && (!view.connection || editingConnection) ? (
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
                placeholder={view.connection ? 'Enter a new key to replace the credential' : 'Provider API key'}
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
              {saving ? 'Saving…' : view.connection ? 'Replace connection' : 'Save connection'}
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
