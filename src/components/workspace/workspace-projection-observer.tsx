'use client';

import { useGraphQuery } from '@ontahi/react/graph';
import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

import { workspaceProjectionRevisionQuery } from '@/atlas/workspace/workspace-client-query';

export const WorkspaceProjectionObserver = ({
  renderedRevisionId,
  autoRefresh = process.env.NODE_ENV === 'development',
}: {
  renderedRevisionId: string | null | undefined;
  autoRefresh?: boolean;
}) => {
  const revisionQuery = useGraphQuery(workspaceProjectionRevisionQuery, {
    refetchInterval: 2_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: 'always',
  });
  const refreshedRevisionId = useRef<string | null>(null);
  const router = useRouter();
  const revisionId = revisionQuery.data?.[0]?.id ?? null;
  const updateAvailable = renderedRevisionId !== undefined && revisionId !== null &&
    revisionId !== renderedRevisionId;

  useEffect(() => {
    if (!autoRefresh || !updateAvailable || refreshedRevisionId.current === revisionId) return;
    refreshedRevisionId.current = revisionId;
    router.refresh();
  }, [autoRefresh, revisionId, router, updateAvailable]);

  if (autoRefresh || !updateAvailable) return null;

  return (
    <aside
      aria-live='polite'
      className='fixed bottom-4 right-4 z-40 flex max-w-[calc(100vw-2rem)] items-center gap-3 rounded-lg border border-border bg-background px-4 py-3 shadow-lg'
    >
      <p className='text-sm font-medium'>Workspace update available</p>
      <button
        type='button'
        className='rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-muted'
        onClick={() => router.refresh()}
      >
        Reload
      </button>
    </aside>
  );
};
