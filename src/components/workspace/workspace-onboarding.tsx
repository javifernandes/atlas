'use client';

import { useOperation } from '@ontahi/react/graph';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';

import { AtlasWorkspaceAdministrationClient } from '@/atlas/client/workspace-administration';
import { normalizeWorkspaceSlug } from '@/atlas/model/workspace-administration';

const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;

export const WorkspaceOnboarding = ({ userName }: { userName: string }) => {
  const router = useRouter();
  const createWorkspace = useOperation(AtlasWorkspaceAdministrationClient.domain.create);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [slowCreation, setSlowCreation] = useState(false);

  useEffect(() => {
    if (!createWorkspace.isExecuting) {
      setSlowCreation(false);
      return;
    }
    const timer = globalThis.setTimeout(() => setSlowCreation(true), 1000);
    return () => globalThis.clearTimeout(timer);
  }, [createWorkspace.isExecuting]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (createWorkspace.isExecuting) return;
    setError(null);
    try {
      const result = await createWorkspace.executeAsync({ name, slug });
      if (!result.ok) throw new Error(result.message);
      router.push(`/w/${encodeURIComponent(result.value.slug)}`);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Atlas could not create the Workspace.');
    }
  };

  return (
    <main className='grid min-h-screen place-items-center bg-background px-6 py-12 text-foreground'>
      <form
        className='grid w-full max-w-md gap-6 rounded-2xl border border-border bg-card p-7 shadow-xl'
        onSubmit={submit}
      >
        <header className='grid gap-2'>
          <p className='font-mono text-xs uppercase tracking-[0.18em] text-primary'>New Workspace</p>
          <h1 className='text-2xl font-semibold'>Welcome, {firstName(userName)}</h1>
          <p className='text-sm leading-6 text-muted-foreground'>
            Create a home for your projects. You can connect repositories next.
          </p>
        </header>
        <label className='grid gap-2 text-sm font-medium'>
          Name
          <input
            autoFocus
            className='h-11 rounded-md border border-border bg-background px-3 font-normal outline-none focus:border-primary'
            maxLength={80}
            onChange={event => {
              const nextName = event.target.value;
              setName(nextName);
              setSlug(normalizeWorkspaceSlug(nextName));
            }}
            placeholder='My Workspace'
            required
            value={name}
          />
        </label>
        {slug ? (
          <p className='flex items-center gap-2 text-sm text-muted-foreground'>
            <span>Your Workspace URL</span>
            <span className='font-mono text-foreground'>/w/{slug}</span>
          </p>
        ) : null}
        {error ? <p className='text-sm text-destructive' role='alert'>{error}</p> : null}
        <button
          className='h-11 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50'
          disabled={createWorkspace.isExecuting || name.trim().length === 0 || slug.length < 2}
          type='submit'
        >
          {createWorkspace.isExecuting
            ? slowCreation ? 'Preparing Atlas locally…' : 'Creating…'
            : 'Create Workspace'}
        </button>
      </form>
    </main>
  );
};
