'use client';

import { useOperation } from '@ontahi/react/graph';
import { useEffect, useMemo, useState } from 'react';

import { AtlasWorkspaceAdministrationClient } from '@/atlas/client/workspace-administration';
import { atlasAuthClient } from '@/auth/client';

type RepositoryChoice = {
  defaultRef: string;
  fullName: string;
  isPrivate: boolean;
};

export const WorkspaceSourceConnection = ({
  canManage,
  onConnected,
  onContinue,
  workspaceId,
}: {
  canManage: boolean;
  onConnected?: () => Promise<unknown>;
  onContinue?: (repositories: string[]) => void;
  workspaceId: string;
}) => {
  const registerSource = useOperation(AtlasWorkspaceAdministrationClient.domain.registerSource);
  const listRepositories = useOperation(
    AtlasWorkspaceAdministrationClient.domain.listRepositories,
  );
  const [repositories, setRepositories] = useState<RepositoryChoice[]>([]);
  const [connectedRepositories, setConnectedRepositories] = useState<string[]>([]);
  const [connectingRepository, setConnectingRepository] = useState<string | null>(null);
  const [authorizationRequired, setAuthorizationRequired] = useState(false);
  const [loadingRepositories, setLoadingRepositories] = useState(true);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!canManage) return;
    let active = true;
    void listRepositories.executeAsync({ workspace: { id: workspaceId } }).then(result => {
      if (!active) return;
      if (!result.ok) {
        setMessage(result.message);
        setLoadingRepositories(false);
        return;
      }
      setAuthorizationRequired(result.value.authorizationRequired);
      setRepositories(result.value.repositories);
      setLoadingRepositories(false);
    });
    return () => { active = false; };
  }, [canManage, workspaceId]);

  const visibleRepositories = useMemo(() => {
    const query = search.trim().toLowerCase();
    return repositories.filter(candidate =>
      !query || candidate.fullName.toLowerCase().includes(query),
    );
  }, [repositories, search]);

  const authorize = async () => {
    setMessage(null);
    const result = await atlasAuthClient.linkSocial({
      callbackURL: globalThis.location.pathname,
      errorCallbackURL: globalThis.location.pathname,
      provider: 'github',
      scopes: ['read:user', 'user:email', 'repo'],
    });
    if (result.error) setMessage(result.error.message ?? 'GitHub authorization failed.');
  };

  const connect = async (repository: string) => {
    if (!canManage || registerSource.isExecuting || connectingRepository) return;
    setConnectingRepository(repository);
    setMessage(null);
    try {
      const result = await registerSource.executeAsync({
        workspace: { id: workspaceId },
        repository,
      });
      if (!result.ok) throw new Error(result.message);
      setConnectedRepositories(current => [...current, result.value.repository]);
      if (onConnected) await onConnected();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Atlas could not connect that repository.');
    } finally {
      setConnectingRepository(null);
    }
  };

  return (
    <div className='grid gap-3 rounded-lg border border-border p-4'>
      <div className='grid gap-2 text-sm font-medium'>
        <span>GitHub repository</span>
        {loadingRepositories ? (
          <div className='rounded-md border border-border px-3 py-4 text-sm font-normal text-muted-foreground'>
            Checking GitHub access…
          </div>
        ) : authorizationRequired ? (
          <button
            className='h-10 justify-self-start rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground'
            onClick={() => void authorize()}
            type='button'
          >
            Authorize GitHub repositories
          </button>
        ) : (
          <>
          <input
            autoComplete='off'
            className='h-10 rounded-md border border-border bg-background px-3 font-normal outline-none focus:border-primary disabled:opacity-60'
            disabled={!canManage || listRepositories.isExecuting}
            onChange={event => setSearch(event.target.value)}
            placeholder='Search your repositories…'
            value={search}
          />
          <div className='max-h-56 overflow-y-auto rounded-md border border-border'>
            {listRepositories.isExecuting ? (
              <p className='px-3 py-4 text-sm font-normal text-muted-foreground'>Loading repositories…</p>
            ) : visibleRepositories.length === 0 ? (
              <p className='px-3 py-4 text-sm font-normal text-muted-foreground'>No matching repositories.</p>
            ) : visibleRepositories.map(candidate => {
              const connected = connectedRepositories.includes(candidate.fullName);
              const connecting = connectingRepository === candidate.fullName;
              return (
              <div
                className='flex w-full items-center justify-between gap-3 border-b border-border/70 px-3 py-2 text-left text-sm font-normal last:border-b-0'
                key={candidate.fullName}
              >
                <span className='min-w-0'>
                  <span className='block truncate'>{candidate.fullName}</span>
                  <span className='block text-xs text-muted-foreground'>
                    {candidate.isPrivate ? 'Private' : 'Public'} · {candidate.defaultRef}
                  </span>
                </span>
                <button
                  className='h-8 shrink-0 rounded-md border border-border px-3 text-xs font-medium hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-60'
                  disabled={!canManage || connected || connecting || Boolean(connectingRepository)}
                  onClick={() => void connect(candidate.fullName)}
                  type='button'
                >
                  {connecting ? 'Adding…' : connected ? 'Added' : 'Add'}
                </button>
              </div>
            );})}
          </div>
          </>
        )}
      </div>
      <p className='text-xs text-muted-foreground'>
        Choose from repositories GitHub confirms are available to your account. Atlas uses the
        repository's default branch.
      </p>
      {!canManage ? (
        <p className='text-xs text-muted-foreground'>Only a Workspace owner can connect repositories.</p>
      ) : null}
      {message ? <p className='text-xs text-muted-foreground' role='status'>{message}</p> : null}
      {onContinue ? (
        <button
          className='h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50'
          disabled={connectedRepositories.length === 0 || Boolean(connectingRepository)}
          onClick={() => onContinue(connectedRepositories)}
          type='button'
        >
          Continue
        </button>
      ) : null}
    </div>
  );
};
