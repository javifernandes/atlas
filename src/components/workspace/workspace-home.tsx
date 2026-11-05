import { ArrowRight, Plus } from 'lucide-react';
import Link from 'next/link';

import type { AtlasWorkspaceAccess } from '@/atlas/workspace/workspace-access';
import type { AtlasViewer } from '@/auth/access';

import { AuthControl } from '../auth/auth-control';

const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;

export const WorkspaceHome = ({
  authAvailable,
  viewer,
  workspaces,
}: {
  authAvailable: boolean;
  viewer: AtlasViewer;
  workspaces: AtlasWorkspaceAccess[];
}) => (
  <main className='min-h-screen bg-background px-6 py-12 text-foreground'>
    <div className='mx-auto grid w-full max-w-4xl gap-10'>
      <header className='flex items-start justify-between gap-6'>
        <div className='grid gap-2'>
          <p className='font-mono text-xs uppercase tracking-[0.18em] text-primary'>Atlas</p>
          <h1 className='text-3xl font-semibold'>Your Workspaces</h1>
          <p className='text-sm text-muted-foreground'>
            Welcome back, {firstName(viewer.name)}. Choose a Workspace or create one.
          </p>
        </div>
        <AuthControl authAvailable={authAvailable} viewer={viewer} />
      </header>

      <section className='grid gap-4 sm:grid-cols-2'>
        {workspaces.map(workspace => (
          <Link
            className='group grid min-h-36 content-between gap-6 rounded-xl border border-border bg-card p-5 transition hover:border-primary/60 hover:shadow-lg'
            href={`/w/${encodeURIComponent(workspace.slug)}`}
            key={workspace.id}
          >
            <div className='grid gap-1'>
              <h2 className='text-lg font-medium'>{workspace.name}</h2>
              <p className='font-mono text-xs text-muted-foreground'>/w/{workspace.slug}</p>
            </div>
            <div className='flex items-center justify-between text-xs text-muted-foreground'>
              <span>{workspace.role} · {workspace.visibility}</span>
              <ArrowRight className='size-4 transition-transform group-hover:translate-x-1' />
            </div>
          </Link>
        ))}
        <Link
          className='grid min-h-36 place-content-center gap-3 rounded-xl border border-dashed border-border p-5 text-center text-muted-foreground transition hover:border-primary/60 hover:text-foreground'
          href='/workspaces/new'
        >
          <Plus className='mx-auto size-5' />
          <span className='text-sm font-medium'>Create Workspace</span>
        </Link>
      </section>
    </div>
  </main>
);
