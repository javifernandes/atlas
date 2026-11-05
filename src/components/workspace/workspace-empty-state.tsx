'use client';

import Link from 'next/link';
import { useState } from 'react';

import type { AtlasWorkspaceAccess } from '@/atlas/workspace/workspace-access';

import { WorkspaceControl } from './workspace-control';
import { WorkspaceSourceConnection } from './workspace-source-connection';

export const WorkspaceEmptyState = ({
  workspace,
  workspaces,
}: {
  workspace: AtlasWorkspaceAccess;
  workspaces: AtlasWorkspaceAccess[];
}) => {
  const [connectedRepositories, setConnectedRepositories] = useState<string[] | null>(null);

  return (
  <main className='grid min-h-screen place-items-center bg-background px-6 text-foreground'>
    <WorkspaceControl workspace={workspace} workspaces={workspaces} />
    <section className='grid w-full max-w-xl gap-5'>
      <div className='grid gap-2 text-center'>
      <p className='font-mono text-xs uppercase tracking-[0.18em] text-primary'>Workspace setup</p>
      <h1 className='text-3xl font-semibold'>{workspace.name}</h1>
      <p className='text-sm leading-6 text-muted-foreground'>
        {connectedRepositories
          ? 'Your Workspace and repository Sources are ready.'
          : 'Connect one or more GitHub repositories to bring this project into Atlas.'}
      </p>
      </div>
      {connectedRepositories ? (
        <div className='grid gap-4 rounded-lg border border-border p-5'>
          <div>
            <h2 className='font-medium'>Workspace created</h2>
            <p className='mt-1 text-sm text-muted-foreground'>
              {connectedRepositories.length}{' '}
              {connectedRepositories.length === 1 ? 'repository is' : 'repositories are'} connected.
              Optional Workspace LLM configuration is the next onboarding slice.
            </p>
          </div>
          <Link
            className='h-10 rounded-md bg-primary px-4 py-2 text-center text-sm font-medium text-primary-foreground'
            href={`/w/${workspace.slug}/settings`}
          >
            Open Workspace
          </Link>
        </div>
      ) : workspace.role === 'owner' ? (
        <WorkspaceSourceConnection
          canManage
          onContinue={setConnectedRepositories}
          workspaceId={workspace.id}
        />
      ) : null}
    </section>
  </main>
  );
};
