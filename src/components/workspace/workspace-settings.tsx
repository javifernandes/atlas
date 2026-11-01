'use client';

import { useGraphQuery } from '@ontahi/react/graph';
import Link from 'next/link';

import {
  workspaceContributorsQuery,
  workspaceMembersQuery,
  workspaceSettingsQuery,
  workspaceSourcesQuery,
} from '@/atlas/workspace/workspace-client-query';
import type { AtlasViewer } from '@/auth/access';

import { WorkspaceAccessDenied } from './workspace-access-denied';

const roleOrder = { owner: 0, editor: 1, viewer: 2 } as const;

export const WorkspaceSettings = ({ viewer }: { viewer: AtlasViewer }) => {
  const workspaceQuery = useGraphQuery(workspaceSettingsQuery);
  const membersQuery = useGraphQuery(workspaceMembersQuery);
  const sourcesQuery = useGraphQuery(workspaceSourcesQuery);
  const contributorsQuery = useGraphQuery(workspaceContributorsQuery);

  if (
    workspaceQuery.isLoading ||
    membersQuery.isLoading ||
    sourcesQuery.isLoading ||
    contributorsQuery.isLoading
  ) {
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

  if (
    workspaceQuery.isError ||
    membersQuery.isError ||
    sourcesQuery.isError ||
    contributorsQuery.isError
  ) {
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
            onClick={() =>
              void Promise.all([
                workspaceQuery.refetch(),
                membersQuery.refetch(),
                sourcesQuery.refetch(),
                contributorsQuery.refetch(),
              ])
            }
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
  const sources = [...(sourcesQuery.data ?? [])].sort((left, right) =>
    left.sourceId.localeCompare(right.sourceId),
  );
  const contributors = [...(contributorsQuery.data ?? [])].sort(
    (left, right) =>
      right.lastContributedAt.localeCompare(left.lastContributedAt) ||
      left.login.localeCompare(right.login),
  );

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
          <div className='flex items-end justify-between gap-4'>
            <div>
              <h2 className='text-lg font-medium'>Sources</h2>
              <p className='text-sm text-muted-foreground'>
                Repositories observed inside this Workspace.
              </p>
            </div>
            <button
              className='cursor-not-allowed rounded-md border border-border px-3 py-2 text-sm text-muted-foreground'
              disabled
              title='Repository connection arrives in the next source-registration slice'
              type='button'
            >
              Add repository
            </button>
          </div>
          <div className='overflow-hidden rounded-lg border border-border'>
            {sources.length === 0 ? (
              <p className='px-4 py-6 text-sm text-muted-foreground'>
                No Sources are registered for this Workspace yet.
              </p>
            ) : (
              sources.map(source => (
                <div
                  className='grid gap-2 border-b border-border/70 px-4 py-3 last:border-b-0 sm:grid-cols-[1fr_auto]'
                  key={source.id}
                >
                  <div className='min-w-0'>
                    <p className='truncate text-sm font-medium'>
                      {source.repository ?? source.sourceId}
                    </p>
                    <p className='truncate text-xs text-muted-foreground'>
                      {source.provider} · {source.ref} · source: {source.sourceId}
                    </p>
                  </div>
                  <div className='flex items-center gap-3 font-mono text-[11px] uppercase text-muted-foreground'>
                    <span>{source.status}</span>
                    <span>{source.contributorAccess.replaceAll('-', ' ')}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className='grid gap-3'>
          <div>
            <h2 className='text-lg font-medium'>Members</h2>
            <p className='text-sm text-muted-foreground'>
              Membership is explicit. Repository contributors will appear separately for review.
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

        <section className='grid gap-3'>
          <div>
            <h2 className='text-lg font-medium'>Contributors</h2>
            <p className='text-sm text-muted-foreground'>
              Participation derived from merged Pull Requests. Contributors are not Members.
            </p>
          </div>
          <div className='overflow-hidden rounded-lg border border-border'>
            {contributors.length === 0 ? (
              <p className='px-4 py-6 text-sm text-muted-foreground'>
                No attributable contributors have been observed yet.
              </p>
            ) : (
              contributors.map(contributor => (
                <div
                  className='flex items-center justify-between gap-4 border-b border-border/70 px-4 py-3 last:border-b-0'
                  key={contributor.id}
                >
                  <div className='flex min-w-0 items-center gap-3'>
                    {contributor.avatarUrl ? (
                      // Provider avatars are observed presentation evidence, not identity proof.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        alt=''
                        className='h-8 w-8 rounded-full bg-muted object-cover'
                        height={32}
                        src={contributor.avatarUrl}
                        width={32}
                      />
                    ) : (
                      <span className='grid h-8 w-8 shrink-0 place-items-center rounded-full bg-muted text-xs font-medium uppercase'>
                        {contributor.login.slice(0, 1)}
                      </span>
                    )}
                    <div className='min-w-0'>
                      <p className='truncate text-sm font-medium'>@{contributor.login}</p>
                      <p className='truncate text-xs text-muted-foreground'>
                        {contributor.contributionCount}{' '}
                        {contributor.contributionCount === 1 ? 'merged PR' : 'merged PRs'} in{' '}
                        {contributor.sourceId} · latest{' '}
                        {new Date(contributor.lastContributedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className='flex shrink-0 items-center gap-2 font-mono text-[11px] uppercase text-muted-foreground'>
                    {contributor.kind === 'bot' ? <span>bot</span> : null}
                    <span>{contributor.linkedUserId ? 'linked' : 'no Atlas account'}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  );
};
