'use client';

import { AlertTriangle, CheckCircle2, LoaderCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useRuntimeTransportCapability } from '@ontahi/react/graph';

import type { AtlasWorkspaceSyncRun } from '@/atlas/workspace/workspace-task-runs';

const copyFor = (run: AtlasWorkspaceSyncRun) => {
  if (run.status === 'queued') return 'Workspace sync queued';
  if (run.status === 'running' || run.status === 'waiting') {
    return run.progress?.message ?? 'Workspace is syncing';
  }
  if (run.status === 'failed') return run.error?.message ?? 'Workspace sync failed';
  if (run.status === 'cancelled') return 'Workspace sync was cancelled';
  return 'Workspace sync completed';
};

export const WorkspaceSyncActivity = ({
  runs,
}: {
  runs: AtlasWorkspaceSyncRun[];
}) => {
  const run = runs[0];
  if (!run) return null;

  return <WorkspaceSyncRun initialRun={run} />;
};

const WorkspaceSyncRun = ({ initialRun }: { initialRun: AtlasWorkspaceSyncRun }) => {
  const [run, setRun] = useState(initialRun);
  const [showCompleted, setShowCompleted] = useState(false);
  const runtimeTransport = useRuntimeTransportCapability();
  const router = useRouter();
  const refresh = router.refresh;
  const refreshedTerminalRun = useRef<string | null>(null);

  useEffect(() => setRun(initialRun), [initialRun]);

  useEffect(() => {
    const observer = runtimeTransport?.durableOperation;
    if (!observer) return;

    const controller = new AbortController();
    void (async () => {
      try {
        for await (const snapshot of observer.observe(
          { taskId: initialRun.taskId, runId: initialRun.runId },
          { signal: controller.signal },
        )) {
          setRun(current => ({ ...current, ...snapshot }));
          if (
            snapshot.status === 'completed' ||
            snapshot.status === 'failed' ||
            snapshot.status === 'cancelled'
          ) {
            if (snapshot.status === 'completed') setShowCompleted(true);
            const terminalKey = `${snapshot.taskId}:${snapshot.runId}:${snapshot.status}`;
            if (refreshedTerminalRun.current !== terminalKey) {
              refreshedTerminalRun.current = terminalKey;
              refresh();
            }
          }
        }
      } catch {
        // The explicit refresh remains available when a transport disconnects.
      }
    })();

    return () => controller.abort();
  }, [initialRun.runId, initialRun.taskId, refresh, runtimeTransport]);

  useEffect(() => {
    if (run.status !== 'completed' || !showCompleted) return;
    const timeout = globalThis.setTimeout(() => setShowCompleted(false), 4000);
    return () => globalThis.clearTimeout(timeout);
  }, [run.status, showCompleted]);

  if (run.status === 'completed' && !showCompleted) return null;

  const active = run.status === 'queued' || run.status === 'running' || run.status === 'waiting';
  const failed = run.status === 'failed' || run.status === 'cancelled';
  const Icon = active ? LoaderCircle : failed ? AlertTriangle : CheckCircle2;

  return (
    <aside
      aria-live='polite'
      className='fixed bottom-4 left-4 z-40 flex max-w-sm items-center gap-3 rounded-lg border border-border bg-background/95 px-4 py-3 shadow-lg backdrop-blur'
    >
      <Icon
        aria-hidden
        className={`h-4 w-4 shrink-0 ${active ? 'animate-spin text-primary' : failed ? 'text-destructive' : 'text-emerald-500'}`}
      />
      <div className='min-w-0 flex-1'>
        <p className='text-sm font-medium'>
          {run.status === 'completed' ? 'Workspace updated' : copyFor(run)}
        </p>
        <p className='text-xs text-muted-foreground'>
          {active
            ? 'You can keep working and check again at any time.'
            : run.status === 'completed'
              ? 'The latest projection is ready.'
            : 'Refresh Atlas to load the latest Workspace projection.'}
        </p>
      </div>
    </aside>
  );
};
