'use client';

import { useGraphQuery } from '@ontahi/react/graph';
import Link from 'next/link';

import {
  workspaceMembersQuery,
  workspaceSettingsQuery,
} from '@/atlas/workspace/workspace-client-query';
import type { AtlasViewer } from '@/auth/access';

import { WorkspaceAccessDenied } from './workspace-access-denied';

const roleOrder = { owner: 0, editor: 1, viewer: 2 } as const;

export const WorkspaceSettings = ({ viewer }: { viewer: AtlasViewer }) => {
  const workspaceQuery = useGraphQuery(workspaceSettingsQuery);
  const membersQuery = useGraphQuery(workspaceMembersQuery);

  if (workspaceQuery.isLoading || membersQuery.isLoading) {
    return (
      <main className='min-h-screen bg-background px-6 py-12 text-foreground'>
        <div className='mx-auto grid w-full max-w-3xl gap-6' aria-label='Loading workspace settings'>
          <div className='h-4 w-32 animate-pulse rounded bg-muted' />
          <div className='h-10 w-64 animate-pulse rounded bg-muted' />
          <div className='h-40 animate-pulse rounded-lg border border-border bg-muted/40' />
        </div>
      </main>
    );
  }

  if (workspaceQuery.isError || membersQuery.isError) {
    return (
      <main className='grid min-h-screen place-items-center bg-background px-6 text-foreground'>
        <section className='grid max-w-md gap-4 text-center'>
          <p className='font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground'>
            Workspace settings
          </p>
          <h1 className='text-2xl font-semibold'>Settings unavailable</h1>
          <p className='text-sm leading-6 text-muted-foreground'>
            Atlas could not load the authorized Workspace view. Try again from this page.
          </p>
          <button
            className='text-sm text-primary hover:underline'
            onClick={() => void Promise.all([workspaceQuery.refetch(), membersQuery.refetch()])}
            type='button'
          >
            Try again
          </button>
        </section>
      </main>
    );
  }

  const workspace = workspaceQuery.data?.[0];

  if (!workspace) return <WorkspaceAccessDenied viewer={viewer} />;

  const memberships = (membersQuery.data ?? [])
    .filter(
      (
        membership,
      ): membership is typeof membership & { user: NonNullable<typeof membership.user> } =>
        membership.user !== null,
    )
    .sort(
      (left, right) =>
        roleOrder[left.role] - roleOrder[right.role] ||
        left.user.name.localeCompare(right.user.name),
    );
  const viewerMembership = memberships.find(membership => membership.userId === viewer.id);

  return (
    <main className='min-h-screen bg-background px-6 py-12 text-foreground'>
      <div className='mx-auto grid w-full max-w-3xl gap-8'>
        <header className='grid gap-2'>
          <Link className='text-sm text-muted-foreground hover:text-foreground' href='/'>
            ← Back to Atlas
          </Link>
          <p className='font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground'>
            Workspace settings
          </p>
          <h1 className='text-3xl font-semibold'>{workspace.name}</h1>
          <p className='text-sm text-muted-foreground'>
            /{workspace.slug} · {workspace.visibility} · your role:{' '}
            {viewerMembership?.role ?? 'member'}
          </p>
        </header>

        <section className='grid gap-3'>
          <div>
            <h2 className='text-lg font-medium'>Members</h2>
            <p className='text-sm text-muted-foreground'>
              Invitations and role management arrive in the next sharing slice.
            </p>
          </div>
          <div className='overflow-hidden rounded-lg border border-border'>
            {memberships.map(membership => (
              <div
                className='flex items-center justify-between gap-4 border-b border-border/70 px-4 py-3 last:border-b-0'
                key={membership.id}
              >
                <div className='min-w-0'>
                  <p className='truncate text-sm font-medium'>{membership.user.name}</p>
                  <p className='truncate text-xs text-muted-foreground'>
                    {membership.user.email}
                  </p>
                </div>
                <span className='font-mono text-xs uppercase text-muted-foreground'>
                  {membership.role}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
};
