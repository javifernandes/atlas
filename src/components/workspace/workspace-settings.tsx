'use client';

import { useDurableOperation, useGraphQuery, useOperation } from '@ontahi/react/graph';
import { AlertTriangle, ExternalLink, GitCommit, History } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { AtlasWorkspaceAdministrationClient } from '@/atlas/client/workspace-administration';
import {
  workspaceContributorsQuery,
  workspaceMembersQuery,
  workspaceSettingsQuery,
  workspaceSourceImportsQuery,
  workspaceSourcesQuery,
} from '@/atlas/workspace/workspace-client-query';
import type { AtlasViewer } from '@/auth/access';
import type { AtlasWorkspaceSyncRun } from '@/atlas/workspace/workspace-task-runs';

import { WorkspaceAccessDenied } from './workspace-access-denied';
import { WorkspaceSourceConnection } from './workspace-source-connection';
import { WorkspaceSyncActivity } from './workspace-sync-activity';
import { Modal } from '../ui/modal';
import { Select } from '../ui/select';

const roleOrder = { owner: 0, collaborator: 1, viewer: 2 } as const;

export type WorkspaceSettingsSection = 'general' | 'history' | 'people' | 'sources';

const settingsSections: Array<{
  description: string;
  id: WorkspaceSettingsSection;
  label: string;
}> = [
  { description: 'Identity and access', id: 'general', label: 'General' },
  { description: 'Repositories and imports', id: 'sources', label: 'Sources' },
  { description: 'Imports and provider events', id: 'history', label: 'History' },
  { description: 'Members and contributors', id: 'people', label: 'People' },
];

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

const importDuration = (startedAt: string, completedAt: string | null) => {
  if (!completedAt) return null;
  const milliseconds = Date.parse(completedAt) - Date.parse(startedAt);
  return milliseconds < 1_000
    ? `${milliseconds} ms`
    : `${(milliseconds / 1_000).toFixed(milliseconds < 10_000 ? 1 : 0)} s`;
};

const WorkspaceImportHistory = ({
  canManage,
  imports,
  onChanged,
  workspaceId,
}: {
  canManage: boolean;
  imports: Array<{
    id: string;
    trigger: 'connection' | 'manual' | 'push' | 'pull-request';
    providerDeliveryId: string | null;
    triggerRevision: string | null;
    pullRequestNumber: number | null;
    repository: string | null;
    observedRevision: string | null;
    status: string;
    startedAt: string;
    completedAt: string | null;
    error: string | null;
  }>;
  onChanged: () => Promise<unknown>;
  workspaceId: string;
}) => {
  const reconcileSources = useDurableOperation(
    AtlasWorkspaceAdministrationClient.domain.reconcileSources,
  );
  const [message, setMessage] = useState<string | null>(null);

  const retry = async () => {
    setMessage(null);
    const result = await reconcileSources.executeAsync({
      workspace: { id: workspaceId },
      triggerSourceId: null,
      trigger: 'manual',
    });
    if (!result.ok) {
      setMessage(result.message);
    }
    await onChanged();
  };

  useEffect(() => {
    if (reconcileSources.runError?.message) {
      setMessage(reconcileSources.runError.message);
    }
  }, [reconcileSources.runError?.message]);

  return (
    <section className='grid gap-5'>
      <div className='flex items-end justify-between gap-4'>
        <div className='grid gap-1'>
          <div className='flex items-center gap-2'>
            <History className='size-5 text-primary' />
            <h2 className='text-xl font-medium'>Import history</h2>
          </div>
          <p className='text-sm text-muted-foreground'>
            Imports and repository events that changed—or failed to change—this Workspace.
          </p>
        </div>
        <button
          className='h-9 rounded-md border border-border px-3 text-sm font-medium hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50'
          disabled={
            !canManage ||
            reconcileSources.isExecuting ||
            reconcileSources.isQueued ||
            reconcileSources.isRunning
          }
          onClick={() => void retry()}
          type='button'
        >
          {reconcileSources.isExecuting || reconcileSources.isQueued || reconcileSources.isRunning
            ? 'Importing…'
            : 'Import now'}
        </button>
      </div>
      <div className='overflow-hidden rounded-xl border border-border'>
        {imports.length === 0 ? (
          <p className='px-4 py-6 text-sm text-muted-foreground'>
            No imports have run for this Workspace yet.
          </p>
        ) : (
          imports.map(sourceImport => {
            const duration = importDuration(sourceImport.startedAt, sourceImport.completedAt);
            return (
              <div
                className='grid gap-3 border-b border-border/70 px-4 py-4 last:border-b-0 sm:grid-cols-[1fr_auto]'
                key={sourceImport.id}
              >
                <div className='min-w-0'>
                  <p className='truncate text-sm font-medium'>
                    {sourceImport.repository ?? 'All active Sources'}
                  </p>
                  <p className='truncate text-xs text-muted-foreground'>
                    {sourceImport.trigger} · {new Date(sourceImport.startedAt).toLocaleString()}
                    {duration ? ` · ${duration}` : ''}
                  </p>
                  <div className='mt-1 flex flex-wrap items-center gap-x-3 gap-y-1'>
                  {sourceImport.pullRequestNumber && sourceImport.repository ? (
                    <a
                      className='inline-flex items-center gap-1 font-mono text-[11px] text-primary hover:underline'
                      href={`https://github.com/${sourceImport.repository}/pull/${sourceImport.pullRequestNumber}`}
                      rel='noreferrer'
                      target='_blank'
                    >
                      PR #{sourceImport.pullRequestNumber}
                      <ExternalLink className='size-3' />
                    </a>
                  ) : null}
                  {sourceImport.triggerRevision && sourceImport.repository ? (
                    <a
                      className='inline-flex items-center gap-1.5 font-mono text-[11px] text-primary hover:underline'
                      href={`https://github.com/${sourceImport.repository}/commit/${sourceImport.triggerRevision}`}
                      rel='noreferrer'
                      target='_blank'
                    >
                      <GitCommit className='size-3.5' />
                      {sourceImport.triggerRevision.slice(0, 12)}
                      <ExternalLink className='size-3' />
                    </a>
                  ) : null}
                  {!sourceImport.triggerRevision && sourceImport.observedRevision && sourceImport.repository ? (
                    <a
                      className='inline-flex items-center gap-1.5 font-mono text-[11px] text-primary hover:underline'
                      href={`https://github.com/${sourceImport.repository}/tree/${sourceImport.observedRevision}`}
                      rel='noreferrer'
                      target='_blank'
                    >
                      <GitCommit className='size-3.5' />
                      {sourceImport.observedRevision.slice(0, 12)}
                      <ExternalLink className='size-3' />
                    </a>
                  ) : null}
                  </div>
                  {sourceImport.error ? (
                    <p className='mt-1 text-xs text-destructive'>{sourceImport.error}</p>
                  ) : null}
                </div>
                <span className='font-mono text-[11px] uppercase text-muted-foreground'>
                  {sourceImport.status.replaceAll('-', ' ')}
                </span>
              </div>
            );
          })
        )}
      </div>
      {message ? <p className='text-xs text-destructive' role='alert'>{message}</p> : null}
    </section>
  );
};

const WorkspaceVisibilitySettings = ({
  canManage,
  onChanged,
  workspace,
}: {
  canManage: boolean;
  onChanged: () => Promise<unknown>;
  workspace: { id: string; visibility: 'private' | 'public' };
}) => {
  const updateVisibility = useOperation(
    AtlasWorkspaceAdministrationClient.domain.updateVisibility,
  );
  const [visibility, setVisibility] = useState(workspace.visibility);
  const [message, setMessage] = useState<string | null>(null);

  const save = async () => {
    if (!canManage || visibility === workspace.visibility || updateVisibility.isExecuting) return;
    setMessage(null);
    try {
      const result = await updateVisibility.executeAsync({
        workspace: { id: workspace.id },
        visibility,
      });
      if (!result.ok) throw new Error(result.message);
      await onChanged();
      setMessage('Visibility updated.');
    } catch (cause) {
      setMessage(
        cause instanceof Error ? cause.message : 'Atlas could not update Workspace visibility.',
      );
    }
  };

  return (
    <section className='grid gap-3'>
      <div>
        <h2 className='text-lg font-medium'>Visibility</h2>
        <p className='text-sm text-muted-foreground'>
          Choose who can discover and read this Workspace.
        </p>
      </div>
      <div className='grid gap-4 rounded-lg border border-border p-4 sm:grid-cols-[1fr_auto] sm:items-end'>
        <Select
          disabled={!canManage || updateVisibility.isExecuting}
          label='Workspace access'
          onChange={setVisibility}
          options={[
            { value: 'private', label: 'Private', description: 'Only Workspace members can read it.' },
            { value: 'public', label: 'Public', description: 'Anyone can discover and read it.' },
          ]}
          value={visibility}
        />
        <button
          className='h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50'
          disabled={
            !canManage || visibility === workspace.visibility || updateVisibility.isExecuting
          }
          onClick={() => void save()}
          type='button'
        >
          {updateVisibility.isExecuting ? 'Saving…' : 'Save visibility'}
        </button>
        {!canManage ? (
          <p className='text-xs text-muted-foreground sm:col-span-2'>
            Only a Workspace owner can change visibility.
          </p>
        ) : null}
        {message ? (
          <p className='text-xs text-muted-foreground sm:col-span-2' role='status'>
            {message}
          </p>
        ) : null}
      </div>
    </section>
  );
};

const WorkspaceDangerZone = ({
  canManage,
  contributorCount,
  memberCount,
  sourceCount,
  workspace,
}: {
  canManage: boolean;
  contributorCount: number;
  memberCount: number;
  sourceCount: number;
  workspace: { id: string; name: string; slug: string };
}) => {
  const deleteWorkspace = useOperation(AtlasWorkspaceAdministrationClient.domain.delete);
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmationSlug, setConfirmationSlug] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const remove = async () => {
    if (
      !canManage ||
      confirmationSlug !== workspace.slug ||
      deleteWorkspace.isExecuting
    ) return;
    setMessage(null);
    try {
      const result = await deleteWorkspace.executeAsync({
        workspace: { id: workspace.id },
        confirmationSlug,
      });
      if (!result.ok) throw new Error(result.message);
      router.push('/');
      router.refresh();
    } catch (cause) {
      setMessage(
        cause instanceof Error ? cause.message : 'Atlas could not delete this Workspace.',
      );
    }
  };

  return (
    <section className='grid gap-3 border-t border-destructive/40 pt-8'>
      <div>
        <h2 className='text-lg font-medium text-destructive'>Danger Zone</h2>
        <p className='text-sm text-muted-foreground'>
          Destructive Workspace lifecycle actions live here.
        </p>
      </div>
      <div className='flex flex-col gap-4 rounded-lg border border-destructive/50 p-4 sm:flex-row sm:items-center sm:justify-between'>
        <div className='grid gap-1'>
          <h3 className='text-sm font-medium'>Delete {workspace.name}</h3>
          <p className='text-sm leading-6 text-muted-foreground'>
            Permanently remove this Workspace and its Atlas data.
          </p>
        </div>
        <button
          className='h-10 shrink-0 rounded-md border border-destructive/60 px-4 text-sm font-medium text-destructive hover:bg-destructive hover:text-destructive-foreground disabled:cursor-not-allowed disabled:opacity-50'
          disabled={!canManage}
          onClick={() => setModalOpen(true)}
          type='button'
        >
          Delete Workspace
        </button>
        {!canManage ? (
          <p className='text-xs text-muted-foreground'>
            Only a Workspace owner can delete this Workspace.
          </p>
        ) : null}
      </div>
      <Modal
        description='This action cannot be undone from Atlas.'
        onClose={() => {
          if (!deleteWorkspace.isExecuting) {
            setModalOpen(false);
            setConfirmationSlug('');
            setMessage(null);
          }
        }}
        open={modalOpen}
        title={`Delete ${workspace.name}?`}
      >
        <div className='grid gap-5'>
          <div className='flex gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4'>
            <AlertTriangle className='mt-0.5 size-5 shrink-0 text-destructive' />
            <p className='text-sm leading-6 text-muted-foreground'>
              This removes {memberCount} {memberCount === 1 ? 'membership' : 'memberships'}, {' '}
              {sourceCount} {sourceCount === 1 ? 'Source' : 'Sources'}, and {contributorCount} derived {' '}
              {contributorCount === 1 ? 'contributor' : 'contributors'}. GitHub repositories and your Atlas account remain untouched.
            </p>
          </div>
          <label className='grid gap-2 text-sm font-medium'>
            Type <span className='font-mono text-destructive'>{workspace.slug}</span> to confirm
            <input
              autoComplete='off'
              autoFocus
              className='h-11 rounded-lg border border-destructive/50 bg-background px-3 font-normal outline-none focus:border-destructive focus:ring-2 focus:ring-destructive/20 disabled:opacity-60'
              disabled={deleteWorkspace.isExecuting}
              onChange={event => setConfirmationSlug(event.target.value)}
              value={confirmationSlug}
            />
          </label>
          {message ? <p className='text-xs text-destructive' role='alert'>{message}</p> : null}
          <div className='flex justify-end gap-3'>
            <button
              className='h-10 rounded-md border border-border px-4 text-sm font-medium hover:bg-muted'
              disabled={deleteWorkspace.isExecuting}
              onClick={() => setModalOpen(false)}
              type='button'
            >
              Cancel
            </button>
            <button
              className='h-10 rounded-md bg-destructive px-4 text-sm font-medium text-destructive-foreground disabled:cursor-not-allowed disabled:opacity-50'
              disabled={confirmationSlug !== workspace.slug || deleteWorkspace.isExecuting}
              onClick={() => void remove()}
              type='button'
            >
              {deleteWorkspace.isExecuting ? 'Deleting…' : 'Delete Workspace'}
            </button>
          </div>
        </div>
      </Modal>
    </section>
  );
};

export const WorkspaceSettings = ({
  activeSection = 'general',
  syncRuns = [],
  viewer,
  workspaceRole,
}: {
  activeSection?: WorkspaceSettingsSection;
  syncRuns?: AtlasWorkspaceSyncRun[];
  viewer: AtlasViewer;
  workspaceRole?: 'owner' | 'collaborator' | 'viewer';
}) => {
  const workspaceQuery = useGraphQuery(workspaceSettingsQuery);
  const membersQuery = useGraphQuery(workspaceMembersQuery);
  const sourcesQuery = useGraphQuery(workspaceSourcesQuery);
  const contributorsQuery = useGraphQuery(workspaceContributorsQuery);
  const sourceImportsQuery = useGraphQuery(workspaceSourceImportsQuery);

  if (
    workspaceQuery.isLoading ||
    membersQuery.isLoading ||
    sourcesQuery.isLoading ||
    contributorsQuery.isLoading ||
    sourceImportsQuery.isLoading
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
    contributorsQuery.isError ||
    sourceImportsQuery.isError
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
                sourceImportsQuery.refetch(),
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
    .flatMap(membership => {
      const user = membership.user ?? (membership.userId === viewer.id ? viewer : null);
      return user ? [{ ...membership, user }] : [];
    })
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
  const viewerMembership = memberships.find(membership => membership.userId === viewer.id);
  const canManage = (workspaceRole ?? viewerMembership?.role) === 'owner';
  const contributorsToReview = contributorGroups.filter(
    contributor =>
      !contributor.linkedUserId || !memberUserIds.has(contributor.linkedUserId),
  );

  return (
    <main className='min-h-screen bg-background px-6 py-12 text-foreground'>
      <WorkspaceSyncActivity runs={syncRuns} />
      <div className='mx-auto grid w-full max-w-7xl gap-8'>
        <header className='grid gap-2'>
          <Link className='text-sm text-muted-foreground hover:text-foreground' href={`/w/${workspace.slug}`}>
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

        <div className='grid items-start gap-10 lg:grid-cols-[15rem_minmax(0,1fr)]'>
          <nav
            aria-label='Workspace settings sections'
            className='grid gap-1 lg:sticky lg:top-8'
          >
            {settingsSections.map(section => {
              const active = section.id === activeSection;
              return (
                <Link
                  aria-current={active ? 'page' : undefined}
                  className={`grid gap-0.5 rounded-md border-l-2 px-4 py-3 transition-colors ${
                    active
                      ? 'border-primary bg-muted text-foreground'
                      : 'border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                  }`}
                  href={`/w/${encodeURIComponent(workspace.slug)}/settings?section=${section.id}`}
                  key={section.id}
                >
                  <span className='text-sm font-medium'>{section.label}</span>
                  <span className='text-xs'>{section.description}</span>
                </Link>
              );
            })}
          </nav>

          <div className='min-w-0'>
            {activeSection === 'general' ? (
              <div className='grid gap-10'>
                <WorkspaceVisibilitySettings
                  canManage={canManage}
                  onChanged={workspaceQuery.refetch}
                  workspace={workspace}
                />
                <WorkspaceDangerZone
                  canManage={canManage}
                  contributorCount={contributorsQuery.data?.length ?? 0}
                  memberCount={memberships.length}
                  sourceCount={sources.length}
                  workspace={workspace}
                />
              </div>
            ) : null}

            {activeSection === 'sources' ? (
              <div className='grid gap-10'>
                <section className='grid gap-4' id='sources'>
                  <div>
                    <h2 className='text-xl font-medium'>Sources</h2>
                    <p className='text-sm text-muted-foreground'>
                      Repositories observed inside this Workspace.
                    </p>
                  </div>
                  <div className='overflow-hidden rounded-lg border border-border'>
                    {sources.length === 0 ? (
                      <p className='px-4 py-8 text-sm text-muted-foreground'>
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
                  <WorkspaceSourceConnection
                    canManage={canManage}
                    onConnected={() =>
                      Promise.all([sourcesQuery.refetch(), sourceImportsQuery.refetch()])
                    }
                    registeredRepositories={sources.flatMap(source =>
                      source.repository ? [source.repository] : [],
                    )}
                    workspaceId={workspace.id}
                  />
                </section>

              </div>
            ) : null}

            {activeSection === 'history' ? (
              <WorkspaceImportHistory
                canManage={canManage}
                imports={sourceImportsQuery.data ?? []}
                onChanged={sourceImportsQuery.refetch}
                workspaceId={workspace.id}
              />
            ) : null}

            {activeSection === 'people' ? (
              <div className='grid gap-10'>
                <section className='grid gap-3'>
                  <div>
                    <h2 className='text-xl font-medium'>Members</h2>
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
                    <h2 className='text-xl font-medium'>Contributors to review</h2>
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
                              {contributor.linkedUserId
                                ? 'Atlas account linked'
                                : 'no Atlas account'}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </section>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </main>
  );
};
