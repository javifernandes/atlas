'use client';

import {
  Archive,
  Check,
  Circle,
  GitPullRequest,
  Loader2,
  Radio,
  X,
} from 'lucide-react';
import { useOperation } from '@ontahi/react/graph';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { AtlasExecutionStreamClient } from '../client/execution-stream';
import type { AtlasExecutionStreamProjection } from '../model/execution-stream';
import type {
  PlanWorkstreamNode,
  PlanWorkstreamSnapshot,
} from '../model/snapshot';
import { cn } from '@/lib/classes';

type ExecutionStreamViewProps = {
  executionStreams: AtlasExecutionStreamProjection[];
  onOpenPlan: (nodeId: string) => void;
  snapshot: PlanWorkstreamSnapshot;
};

type ExecutionTreeRow = {
  depth: number;
  node: PlanWorkstreamNode;
};

const recentDateFormatter = new Intl.DateTimeFormat('en', {
  dateStyle: 'medium',
  timeZone: 'UTC',
});

const formatRelativeTime = (value: string, now = Date.now()) => {
  const timestamp = Date.parse(value);

  if (!Number.isFinite(timestamp)) {
    return value;
  }

  const minutes = Math.max(0, Math.floor((now - timestamp) / 60_000));

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return days < 7 ? `${days}d ago` : recentDateFormatter.format(new Date(value));
};

const planSourceLabel = (node: PlanWorkstreamNode) => {
  const path = node.path ?? '';
  const scheme = path.match(/^([^:]+):\/\//)?.[1] ?? 'atlas';
  const planNumber = path.split('/').at(-1)?.match(/^(\d+[a-z]?)/i)?.[1];

  return planNumber ? `${scheme} · plan ${planNumber}` : scheme;
};

const buildExecutionTreeRows = (
  stream: AtlasExecutionStreamProjection,
  snapshot: PlanWorkstreamSnapshot,
) => {
  const planNodes = snapshot.nodes.filter(node => node.kind === 'plan');
  const nodesById = new Map(planNodes.map(node => [node.id, node] as const));
  const parentByChild = new Map<string, string>();
  const childrenByParent = new Map<string, string[]>();

  for (const edge of snapshot.edges) {
    if (
      edge.kind !== 'contains' ||
      !nodesById.has(edge.from) ||
      !nodesById.has(edge.to)
    ) {
      continue;
    }

    parentByChild.set(edge.to, edge.from);
    childrenByParent.set(edge.from, [...(childrenByParent.get(edge.from) ?? []), edge.to]);
  }

  const rootIds = stream.roots.map(root => root.id).filter(id => nodesById.has(id));
  const touchedIds = [
    ...stream.activities.flatMap(activity => (activity.plan ? [activity.plan.id] : [])),
    ...(stream.currentFocusPlan ? [stream.currentFocusPlan.id] : []),
  ].filter(id => nodesById.has(id));
  const includedIds = new Set(rootIds);

  for (const touchedId of touchedIds) {
    let currentId: string | undefined = touchedId;
    const visited = new Set<string>();

    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);
      includedIds.add(currentId);
      currentId = parentByChild.get(currentId);
    }
  }

  for (const pathId of [...includedIds]) {
    for (const childId of childrenByParent.get(pathId) ?? []) {
      includedIds.add(childId);
    }
  }

  const rows: ExecutionTreeRow[] = [];
  const rendered = new Set<string>();
  const append = (nodeId: string, depth: number) => {
    const node = nodesById.get(nodeId);

    if (!node || rendered.has(nodeId) || !includedIds.has(nodeId)) {
      return;
    }

    rendered.add(nodeId);
    rows.push({ depth, node });

    for (const childId of [...(childrenByParent.get(nodeId) ?? [])].sort((left, right) =>
      (nodesById.get(left)?.shortTitle ?? left).localeCompare(
        nodesById.get(right)?.shortTitle ?? right,
      ),
    )) {
      append(childId, depth + 1);
    }
  };

  for (const rootId of rootIds) {
    append(rootId, 0);
  }

  for (const touchedId of touchedIds) {
    if (!rendered.has(touchedId)) {
      append(touchedId, 0);
    }
  }

  return rows;
};

const ExecutionNodeState = ({
  focused,
  node,
}: {
  focused: boolean;
  node: PlanWorkstreamNode;
}) => {
  if (node.statusGroup === 'done') {
    return <Check aria-hidden='true' className='size-3.5 text-emerald-500' />;
  }

  if (focused) {
    return <Radio aria-hidden='true' className='size-3.5 text-sky-500' />;
  }

  return <Circle aria-hidden='true' className='size-3 text-muted-foreground/70' />;
};

export const ExecutionStreamView = ({
  executionStreams,
  onOpenPlan,
  snapshot,
}: ExecutionStreamViewProps) => {
  const router = useRouter();
  const [confirmingClose, setConfirmingClose] = useState(false);
  const [closeError, setCloseError] = useState<string | null>(null);
  const closeStream = useOperation(AtlasExecutionStreamClient.domain.close);
  const closing = closeStream.isExecuting;
  const currentStream = executionStreams.find(
    stream => stream.mode === 'implicit' && stream.status === 'open',
  );
  const recentStreams = executionStreams.filter(stream => stream.status === 'closed');
  const treeRows = useMemo(
    () => (currentStream ? buildExecutionTreeRows(currentStream, snapshot) : []),
    [currentStream, snapshot],
  );

  useEffect(() => {
    if (!confirmingClose) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !closing) {
        setConfirmingClose(false);
      }
    };

    globalThis.addEventListener('keydown', closeOnEscape);
    return () => globalThis.removeEventListener('keydown', closeOnEscape);
  }, [closing, confirmingClose]);

  const closeCurrentStream = async () => {
    if (!currentStream || closing) return;

    setCloseError(null);

    try {
      const result = await closeStream.executeAsync({ id: currentStream.id });

      if (!result.ok) {
        throw new Error(result.message);
      }

      setConfirmingClose(false);
      router.refresh();
    } catch (error) {
      setCloseError(error instanceof Error ? error.message : 'Atlas could not close this stream.');
    }
  };

  return (
    <section className='absolute inset-0 overflow-y-auto bg-background px-4 pb-24 pt-24 text-foreground sm:px-6'>
      <div className='mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[220px_minmax(0,1fr)]'>
        <aside className='hidden border-r border-border/70 pr-5 lg:block'>
          <h2 className='mb-3 text-sm font-semibold'>Sessions</h2>
          {currentStream ? (
            <div className='rounded-lg border border-sky-500/35 bg-sky-500/10 px-3 py-3'>
              <div className='truncate text-sm font-medium'>{currentStream.title}</div>
              <div className='mt-1 text-xs text-muted-foreground'>Active now · implicit</div>
            </div>
          ) : (
            <div className='text-xs text-muted-foreground'>No active stream</div>
          )}

          {recentStreams.length > 0 ? (
            <div className='mt-7'>
              <div className='mb-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground'>
                Recent
              </div>
              <ul className='grid gap-2'>
                {recentStreams.map(stream => (
                  <li key={stream.id} className='rounded-md px-2 py-2'>
                    <div className='truncate text-xs font-medium'>{stream.title}</div>
                    <div className='mt-1 text-[11px] text-muted-foreground'>
                      Closed {formatRelativeTime(stream.closedAt ?? stream.updatedAt)}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </aside>

        <div className='min-w-0'>
          {currentStream ? (
            <>
              <header className='mb-5 flex flex-wrap items-start justify-between gap-4'>
                <div>
                  <h1 className='text-2xl font-semibold tracking-tight'>Current stream</h1>
                  <p className='mt-1 max-w-2xl text-sm leading-6 text-muted-foreground'>
                    Attributable merged work stays here until you create a boundary.
                  </p>
                </div>
                <button
                  type='button'
                  className='rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium transition-colors hover:border-primary/45 hover:bg-muted/60'
                  onClick={() => setConfirmingClose(true)}
                >
                  Close stream
                </button>
              </header>

              <div className='overflow-hidden rounded-xl border border-border/80 bg-card'>
                <header className='flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-5 py-4'>
                  <div>
                    <div className='font-mono text-[10px] uppercase tracking-wider text-muted-foreground'>
                      Implicit stream
                    </div>
                    <h2 className='mt-1 text-base font-semibold'>{currentStream.title}</h2>
                  </div>
                  <div className='inline-flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-300'>
                    <span className='size-1.5 rounded-full bg-emerald-500' />
                    Open
                  </div>
                </header>

                <div className='grid xl:grid-cols-[minmax(0,1fr)_300px]'>
                  <section className='min-w-0 px-4 py-5 sm:px-5' aria-label='Execution tree'>
                    {treeRows.length > 0 ? (
                      <div className='grid gap-1'>
                        {treeRows.map(({ depth, node }) => {
                          const focused = node.id === currentStream.currentFocusPlan?.id;

                          return (
                            <button
                              key={node.id}
                              type='button'
                              className={cn(
                                'grid min-h-12 w-full grid-cols-[20px_minmax(0,1fr)_auto] items-center gap-2 rounded-lg py-2 pr-2 text-left transition-colors hover:bg-muted/55',
                                focused && 'bg-sky-500/10 hover:bg-sky-500/15',
                              )}
                              style={{ paddingLeft: `${8 + Math.min(depth, 5) * 24}px` }}
                              onClick={() => onOpenPlan(node.id)}
                            >
                              <span className='grid size-5 place-items-center rounded-full border border-border/80 bg-background'>
                                <ExecutionNodeState focused={focused} node={node} />
                              </span>
                              <span className='min-w-0'>
                                <span className='block truncate text-sm font-medium'>
                                  {node.shortTitle}
                                </span>
                                <span className='mt-0.5 block truncate text-[11px] text-muted-foreground'>
                                  {planSourceLabel(node)}
                                </span>
                              </span>
                              <span className='text-[11px] text-muted-foreground'>
                                {focused ? 'focus' : node.statusGroup}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <p className='py-8 text-sm text-muted-foreground'>
                        The referenced Plans are not in the current projection.
                      </p>
                    )}
                  </section>

                  <aside className='border-t border-border/70 bg-muted/15 px-5 py-5 xl:border-l xl:border-t-0'>
                    <h3 className='font-mono text-[10px] uppercase tracking-wider text-muted-foreground'>
                      Recent activity
                    </h3>
                    {currentStream.activities.length > 0 ? (
                      <ol className='mt-4 grid gap-5'>
                        {currentStream.activities.slice(0, 12).map(activity => (
                          <li key={activity.id} className='relative pl-5 text-sm'>
                            <span className='absolute left-0 top-1.5 size-2 rounded-full bg-sky-500' />
                            {activity.pullRequest ? (
                              <a
                                className='group block'
                                href={activity.pullRequest.url}
                                rel='noreferrer'
                                target='_blank'
                              >
                                <span className='flex items-center gap-1.5 font-medium group-hover:text-sky-500'>
                                  <GitPullRequest aria-hidden='true' className='size-3.5' />
                                  PR #{activity.pullRequest.number} merged
                                </span>
                                <span className='mt-1 block leading-5 text-muted-foreground'>
                                  {activity.plan?.title ?? activity.pullRequest.title}
                                </span>
                                <span className='mt-1 block text-[11px] text-muted-foreground'>
                                  {activity.pullRequest.repositoryFullName} ·{' '}
                                  {formatRelativeTime(activity.occurredAt)}
                                </span>
                              </a>
                            ) : (
                              <span className='text-muted-foreground'>Merged PR activity</span>
                            )}
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <p className='mt-4 text-sm text-muted-foreground'>No recorded activity.</p>
                    )}
                  </aside>
                </div>
              </div>
            </>
          ) : (
            <>
              <header className='mb-5'>
                <h1 className='text-2xl font-semibold tracking-tight'>No open stream</h1>
                <p className='mt-1 max-w-2xl text-sm leading-6 text-muted-foreground'>
                  Atlas is waiting for your next attributable merged Pull Request.
                </p>
              </header>
              <div className='grid min-h-80 place-items-center rounded-xl border border-border/80 bg-card px-6 py-12 text-center'>
                <div className='max-w-lg'>
                  <span className='mx-auto grid size-11 place-items-center rounded-xl bg-muted text-muted-foreground'>
                    <Archive aria-hidden='true' className='size-5' />
                  </span>
                  <h2 className='mt-4 text-lg font-semibold'>The next boundary starts itself</h2>
                  <p className='mt-2 text-sm leading-6 text-muted-foreground'>
                    Merge work with Atlas Plan evidence and a new implicit stream will appear here.
                    Closed streams remain in recent history.
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {confirmingClose && currentStream ? (
        <div
          className='fixed inset-0 z-[90] grid place-items-center bg-background/75 px-4 backdrop-blur-sm'
          onMouseDown={event => {
            if (event.target === event.currentTarget && !closing) {
              setConfirmingClose(false);
            }
          }}
        >
          <section
            role='dialog'
            aria-modal='true'
            aria-labelledby='close-execution-stream-title'
            className='w-full max-w-md rounded-xl border border-border bg-background p-5 shadow-2xl'
          >
            <div className='flex items-start justify-between gap-3'>
              <div>
                <h2 id='close-execution-stream-title' className='text-lg font-semibold'>
                  Close “{currentStream.title}”?
                </h2>
                <p className='mt-2 text-sm leading-6 text-muted-foreground'>
                  Plans keep their current status. Your next attributable merge starts a new
                  implicit stream automatically.
                </p>
              </div>
              <button
                type='button'
                aria-label='Cancel close'
                className='grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground'
                disabled={closing}
                onClick={() => setConfirmingClose(false)}
              >
                <X aria-hidden='true' className='size-4' />
              </button>
            </div>

            {closeError ? (
              <p className='mt-3 text-sm text-destructive' role='alert'>
                {closeError}
              </p>
            ) : null}

            <div className='mt-5 flex justify-end gap-2'>
              <button
                type='button'
                className='rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted'
                disabled={closing}
                onClick={() => setConfirmingClose(false)}
              >
                Cancel
              </button>
              <button
                type='button'
                className='inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60'
                disabled={closing}
                onClick={closeCurrentStream}
              >
                {closing ? <Loader2 aria-hidden='true' className='size-4 animate-spin' /> : null}
                Close stream
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
};
