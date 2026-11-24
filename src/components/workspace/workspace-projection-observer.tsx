'use client';

import { useGraphQuery } from '@ontahi/react/graph';
import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

import { workspaceProjectionRevisionQuery } from '@/atlas/workspace/workspace-client-query';

export const WorkspaceProjectionObserver = () => {
  const revisionQuery = useGraphQuery(workspaceProjectionRevisionQuery, {
    refetchInterval: 2_000,
    refetchIntervalInBackground: false,
  });
  const lastRevisionId = useRef<string | null>(null);
  const router = useRouter();
  const revisionId = revisionQuery.data?.[0]?.id ?? null;

  useEffect(() => {
    if (!revisionId) return;
    if (lastRevisionId.current === null) {
      lastRevisionId.current = revisionId;
      return;
    }
    if (lastRevisionId.current === revisionId) return;

    lastRevisionId.current = revisionId;
    router.refresh();
  }, [revisionId, router]);

  return null;
};
