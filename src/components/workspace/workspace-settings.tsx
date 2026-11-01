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

type WorkspaceContributorRow = {
  avatarUrl: string | null;
  contributionCount: number;
  id: string;
  kind: 'person' | 'bot';
  lastContributedAt: string;
  linkedUserId: string | null;
  login: string;
  provider: 'github';
  providerAccountId: string;
  sourceId: string;
};

const groupContributorRows = (rows: WorkspaceContributorRow[]) => {
  const groups = new Map<
    string,
    WorkspaceContributorRow & { sourceIds: string[] }
  >();

  for (const row of rows) {
    const key = row.linkedUserId
      ? `user:${row.linkedUserId}`
      : `${row.provider}:${row.providerAccountId}`;
    const current = groups.get(key);
    if (!current) {
      groups.set(key, { ...row, sourceIds: [row.sourceId] });
      continue;
    }

    current.contributionCount += row.contributionCount;
    if (!current.sourceIds.includes(row.sourceId)) current.sourceIds.push(row.sourceId);
    if (row.lastContributedAt > current.lastContributedAt) {
      current.avatarUrl = row.avatarUrl;
      current.lastContributedAt = row.lastContributedAt;
      current.login = row.login;
    }
  }

  return [...groups.values()]
    .map(group => ({ ...group, sourceIds: group.sourceIds.sort() }))
    .sort(
      (left, right) =>
        right.lastContributedAt.localeCompare(left.lastContributedAt) ||
        left.login.localeCompare(right.login),
    );
};

const participationSummary = (
  contributor: ReturnType<typeof groupContributorRows>[number],
) =>
  `${contributor.contributionCount} ${
    contributor.contributionCount === 1 ? 'merged PR' : 'merged PRs'
  } across ${contributor.sourceIds.join(', ')}`;

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
  const sources = [...(sourcesQuery.data ?? [])].sort((left, right) =>
    left.sourceId.localeCompare(right.sourceId),
  );
  const contributorGroups = groupContributorRows(contributorsQuery.data ?? []);
  const linkedContributorsByUserId = new Map(
    contributorGroups.flatMap(contributor =>
      contributor.linkedUserId ? [[contributor.linkedUserId, contributor] as const] : [],
    ),
  );
  const memberUserIds = new Set(memberships.map(membership => membership.userId));
  const contributorsToReview = contributorGroups.filter(
    contributor =>
      !contributor.linkedUserId || !memberUserIds.has(contributor.linkedUserId),
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
            /{workspace.slug} · {workspace.visibility}
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
            <span
              className='rounded-full border border-border px-3 py-1 font-mono text-[11px] uppercase text-muted-foreground'
              title='An authorized repository connection flow is not implemented yet'
            >
              Connections coming next
            </span>
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
                      {source.provider === 'github' && source.repository ? (
                        <a
                          className='hover:text-primary hover:underline'
                          href={`https://github.com/${source.repository}`}
                          rel='noreferrer'
                          target='_blank'
                        >
                          {source.repository} ↗
                        </a>
                      ) : (
                        source.repository ?? source.sourceId
                      )}
                    </p>
                    <p className='truncate text-xs text-muted-foreground'>
                      {source.provider} · {source.ref}
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
              People with explicit Workspace access, enriched by linked repository activity.
            </p>
          </div>
          <div className='overflow-hidden rounded-lg border border-border'>
            {memberships.map(membership => {
              const participation = linkedContributorsByUserId.get(membership.userId);
              const avatarUrl = membership.user.image ?? participation?.avatarUrl;

              return (
                <div
                  className='flex items-center justify-between gap-4 border-b border-border/70 px-4 py-3 last:border-b-0'
                  key={membership.id}
                >
                  <div className='flex min-w-0 items-center gap-3'>
                    {avatarUrl ? (
                      // Provider avatars are presentation evidence attached to the linked User.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        alt=''
                        className='h-9 w-9 rounded-full bg-muted object-cover'
                        height={36}
                        src={avatarUrl}
                        width={36}
                      />
                    ) : (
                      <span className='grid h-9 w-9 shrink-0 place-items-center rounded-full bg-muted text-xs font-medium uppercase'>
                        {membership.user.name.slice(0, 1)}
                      </span>
                    )}
                    <div className='min-w-0'>
                      <p className='truncate text-sm font-medium'>{membership.user.name}</p>
                      <p className='truncate text-xs text-muted-foreground'>
                        {membership.user.email}
                      </p>
                      {participation ? (
                        <p className='truncate text-xs text-muted-foreground'>
                          <a
                            className='hover:text-foreground hover:underline'
                            href={`https://github.com/${encodeURIComponent(participation.login)}`}
                            rel='noreferrer'
                            target='_blank'
                          >
                            @{participation.login}
                          </a>{' '}
                          · {participationSummary(participation)}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <span className='font-mono text-xs uppercase text-muted-foreground'>
                    {membership.role}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        <section className='grid gap-3'>
          <div>
            <h2 className='text-lg font-medium'>Contributors to review</h2>
            <p className='text-sm text-muted-foreground'>
              Observed repository participants who do not have Workspace access.
            </p>
          </div>
          <div className='overflow-hidden rounded-lg border border-border'>
            {contributorsToReview.length === 0 ? (
              <p className='px-4 py-6 text-sm text-muted-foreground'>
                All observed contributors already have Workspace access.
              </p>
            ) : (
              contributorsToReview.map(contributor => (
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
                      <p className='truncate text-sm font-medium'>
                        <a
                          className='hover:text-primary hover:underline'
                          href={`https://github.com/${encodeURIComponent(contributor.login)}`}
                          rel='noreferrer'
                          target='_blank'
                        >
                          @{contributor.login}
                        </a>
                      </p>
                      <p className='truncate text-xs text-muted-foreground'>
                        {participationSummary(contributor)} · latest{' '}
                        {new Date(contributor.lastContributedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className='flex shrink-0 items-center gap-2 font-mono text-[11px] uppercase text-muted-foreground'>
                    {contributor.kind === 'bot' ? <span>bot</span> : null}
                    <span>
                      {contributor.linkedUserId ? 'Atlas account linked' : 'no Atlas account'}
                    </span>
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
