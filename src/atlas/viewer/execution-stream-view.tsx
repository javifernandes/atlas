'use client';

import {
  Archive,
  Check,
  ChevronDown,
  ChevronRight,
  Circle,
  Copy,
  GitFork,
  GitPullRequest,
  Loader2,
  Radio,
  X,
} from 'lucide-react';
import { useOperation } from '@ontahi/react/graph';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { AtlasExecutionStreamClient } from '../client/execution-stream';
import {
  buildAtlasSessionInstructions,
  type AtlasExecutionStreamProjection,
} from '../model/execution-stream';
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
  hasChildren: boolean;
  node: PlanWorkstreamNode;
};

type ExecutionTreeViewOptions = {
  collapsedNodeIds: ReadonlySet<string>;
  hideDone: boolean;
};

const noCollapsedExecutionTreeNodes = new Set<string>();

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
  { collapsedNodeIds, hideDone }: ExecutionTreeViewOptions,
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
  const processed = new Set<string>();
  const sortedChildren = (nodeId: string) =>
    [...(childrenByParent.get(nodeId) ?? [])]
      .filter(childId => includedIds.has(childId))
      .sort((left, right) =>
        (nodesById.get(left)?.shortTitle ?? left).localeCompare(
          nodesById.get(right)?.shortTitle ?? right,
        ),
      );
  const visibleChildren = (nodeId: string, visited = new Set<string>()): string[] => {
    if (visited.has(nodeId)) {
      return [];
    }

    const nextVisited = new Set(visited).add(nodeId);

    return sortedChildren(nodeId).flatMap(childId => {
      const child = nodesById.get(childId);

      return hideDone && child?.statusGroup === 'done'
        ? visibleChildren(childId, nextVisited)
        : [childId];
    });
  };
  const markDescendantsProcessed = (nodeId: string, visited = new Set<string>()) => {
    if (visited.has(nodeId)) {
      return;
    }

    const nextVisited = new Set(visited).add(nodeId);

    for (const childId of sortedChildren(nodeId)) {
      processed.add(childId);
      markDescendantsProcessed(childId, nextVisited);
    }
  };
  const append = (nodeId: string, depth: number) => {
    const node = nodesById.get(nodeId);

    if (!node || processed.has(nodeId) || !includedIds.has(nodeId)) {
      return;
    }

    processed.add(nodeId);
    const children = hideDone ? visibleChildren(nodeId) : sortedChildren(nodeId);

    if (hideDone && node.statusGroup === 'done') {
      for (const childId of children) {
        append(childId, depth);
      }
      return;
    }

    rows.push({ depth, hasChildren: children.length > 0, node });

    if (collapsedNodeIds.has(nodeId)) {
      markDescendantsProcessed(nodeId);
      return;
    }

    for (const childId of children) {
      append(childId, depth + 1);
    }
  };

  for (const rootId of rootIds) {
    append(rootId, 0);
  }

  for (const touchedId of touchedIds) {
    if (!processed.has(touchedId)) {
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
  const [confirmingFork, setConfirmingFork] = useState(false);
  const [closeError, setCloseError] = useState<string | null>(null);
  const [forkError, setForkError] = useState<string | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [copiedSessionId, setCopiedSessionId] = useState<string | null>(null);
  const [forkTitle, setForkTitle] = useState('');
  const [forkPlanIds, setForkPlanIds] = useState<Set<string>>(() => new Set());
  const [collapsedNodeIds, setCollapsedNodeIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [hideDone, setHideDone] = useState(false);
  const closeStream = useOperation(AtlasExecutionStreamClient.domain.close);
  const forkStream = useOperation(AtlasExecutionStreamClient.domain.fork);
  const closing = closeStream.isExecuting;
  const forking = forkStream.isExecuting;
  const openStreams = executionStreams.filter(stream => stream.status === 'open');
  const recentStreams = executionStreams.filter(stream => stream.status === 'closed');
  const defaultStream =
    executionStreams.find(stream => {
      if (typeof globalThis.window === 'undefined') return false;
      return new URL(globalThis.location.href).searchParams.get('session') === stream.id;
    }) ??
    openStreams.find(stream => stream.mode === 'implicit') ??
    openStreams[0] ??
    recentStreams[0];
  const [selectedStreamId, setSelectedStreamId] = useState<string | null>(
    defaultStream?.id ?? null,
  );
  const currentStream =
    executionStreams.find(stream => stream.id === selectedStreamId) ?? defaultStream;
  const expandedTreeRows = useMemo(
    () =>
      currentStream
        ? buildExecutionTreeRows(currentStream, snapshot, {
            collapsedNodeIds: noCollapsedExecutionTreeNodes,
            hideDone,
          })
        : [],
    [currentStream, hideDone, snapshot],
  );
  const treeRows = useMemo(
    () =>
      currentStream
        ? buildExecutionTreeRows(currentStream, snapshot, {
            collapsedNodeIds,
            hideDone,
          })
        : [],
    [collapsedNodeIds, currentStream, hideDone, snapshot],
  );
  const forkTreeRows = useMemo(
    () =>
      currentStream
        ? buildExecutionTreeRows(currentStream, snapshot, {
            collapsedNodeIds: noCollapsedExecutionTreeNodes,
            hideDone: false,
          })
        : [],
    [currentStream, snapshot],
  );
  const collapsibleNodeIds = expandedTreeRows
    .filter(row => row.hasChildren)
    .map(row => row.node.id);
  const hasCollapsedBranches = collapsibleNodeIds.some(nodeId =>
    collapsedNodeIds.has(nodeId),
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

  useEffect(() => {
    if (!confirmingFork) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !forking) {
        setConfirmingFork(false);
      }
    };

    globalThis.addEventListener('keydown', closeOnEscape);
    return () => globalThis.removeEventListener('keydown', closeOnEscape);
  }, [confirmingFork, forking]);

  const writeSessionRoute = (sessionId: string) => {
    if (typeof globalThis.window === 'undefined') return;

    const nextUrl = new URL(globalThis.location.href);
    nextUrl.searchParams.set('view', 'sessions');
    nextUrl.searchParams.set('session', sessionId);
    nextUrl.searchParams.delete('node');
    nextUrl.searchParams.delete('full');
    nextUrl.searchParams.delete('section');
    globalThis.history.replaceState({}, '', nextUrl);
  };

  const selectStream = (stream: AtlasExecutionStreamProjection) => {
    setSelectedStreamId(stream.id);
    setCollapsedNodeIds(new Set());
    setConfirmingClose(false);
    setConfirmingFork(false);
    setCopyError(null);
    writeSessionRoute(stream.id);
  };

  const copySessionInstructions = async () => {
    if (!currentStream || currentStream.status !== 'open') return;

    setCopyError(null);
    try {
      if (!globalThis.navigator.clipboard) {
        throw new Error('Clipboard access is unavailable.');
      }

      const sessionUrl = new URL(globalThis.location.href);
      sessionUrl.searchParams.set('view', 'sessions');
      sessionUrl.searchParams.set('session', currentStream.id);
      sessionUrl.searchParams.delete('node');
      sessionUrl.searchParams.delete('full');
      sessionUrl.searchParams.delete('section');
      await globalThis.navigator.clipboard.writeText(
        buildAtlasSessionInstructions({
          id: currentStream.id,
          title: currentStream.title,
          url: sessionUrl.toString(),
        }),
      );
      setCopiedSessionId(currentStream.id);
    } catch (error) {
      setCopyError(error instanceof Error ? error.message : 'Atlas could not copy the Session.');
    }
  };

  const openForkDialog = () => {
    if (!currentStream || currentStream.status !== 'open') return;

    setForkError(null);
    setForkPlanIds(new Set());
    setForkTitle(`Fork of ${currentStream.title}`);
    setConfirmingFork(true);
  };

  const toggleForkPlan = (planId: string) => {
    setForkPlanIds(current => {
      const next = new Set(current);
      if (next.has(planId)) next.delete(planId);
      else next.add(planId);
      return next;
    });
  };

  const createFork = async () => {
    if (
      !currentStream ||
      currentStream.status !== 'open' ||
      forking ||
      forkPlanIds.size === 0
    ) {
      return;
    }

    setForkError(null);
    try {
      const result = await forkStream.executeAsync({
        sourceStreamId: currentStream.id,
        title: forkTitle,
        planIds: [...forkPlanIds],
      });

      if (!result.ok) {
        throw new Error(result.message);
      }

      setSelectedStreamId(result.value.id);
      writeSessionRoute(result.value.id);
      setConfirmingFork(false);
      router.refresh();
    } catch (error) {
      setForkError(error instanceof Error ? error.message : 'Atlas could not fork this Session.');
    }
  };

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

  const toggleCollapsedNode = (nodeId: string) => {
    setCollapsedNodeIds(current => {
      const next = new Set(current);

      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }

      return next;
    });
  };

  const toggleAllBranches = () => {
    setCollapsedNodeIds(
      hasCollapsedBranches ? new Set() : new Set(collapsibleNodeIds),
    );
  };

  return (
    <section className='absolute inset-0 overflow-hidden bg-background px-3 pb-4 pt-20 text-foreground sm:px-5'>
      <div className='mx-auto grid h-full min-h-0 w-full max-w-[1480px] overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm lg:grid-cols-[240px_minmax(0,1fr)]'>
        <aside className='hidden min-h-0 flex-col border-r border-border/70 bg-muted/10 lg:flex'>
          <header className='flex h-14 shrink-0 items-center border-b border-border/70 px-4'>
            <h1 className='text-sm font-semibold'>Sessions</h1>
          </header>

          <div className='min-h-0 flex-1 overflow-y-auto p-3'>
            {openStreams.length > 0 ? (
              <div>
                <div className='mb-2 px-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground'>
                  Open
                </div>
                <ul className='grid gap-1.5'>
                  {openStreams.map(stream => {
                    const selected = stream.id === currentStream?.id;

                    return (
                      <li key={stream.id}>
                        <button
                          type='button'
                          aria-current={selected ? 'true' : undefined}
                          className={cn(
                            'w-full rounded-lg border p-3 text-left transition-colors',
                            selected
                              ? 'border-sky-500/35 bg-sky-500/10'
                              : 'border-transparent hover:border-border hover:bg-muted/45',
                          )}
                          onClick={() => selectStream(stream)}
                        >
                          <span className='inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-300'>
                            <span className='size-1.5 rounded-full bg-emerald-500' />
                            Open
                          </span>
                          <span className='mt-2 block line-clamp-2 text-sm font-medium leading-5'>
                            {stream.title}
                          </span>
                          <span className='mt-1 block text-[11px] text-muted-foreground'>
                            {stream.mode === 'explicit' ? 'Explicit session' : 'Implicit session'}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : (
              <div className='rounded-lg border border-dashed border-border px-3 py-4'>
                <div className='text-xs font-medium'>No open Session</div>
                <div className='mt-1 text-[11px] leading-4 text-muted-foreground'>
                  The next attributable untagged merge opens one.
                </div>
              </div>
            )}

            {recentStreams.length > 0 ? (
              <div className='mt-6'>
                <div className='mb-2 px-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground'>
                  Recent
                </div>
                <ul className='grid gap-1'>
                  {recentStreams.map(stream => (
                    <li key={stream.id}>
                      <button
                        type='button'
                        aria-current={stream.id === currentStream?.id ? 'true' : undefined}
                        className={cn(
                          'w-full rounded-md border px-2 py-2.5 text-left transition-colors hover:bg-muted/45',
                          stream.id === currentStream?.id
                            ? 'border-border bg-muted/45'
                            : 'border-transparent',
                        )}
                        onClick={() => selectStream(stream)}
                      >
                        <span className='block truncate text-xs font-medium'>{stream.title}</span>
                        <span className='mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground'>
                          <span className='size-1.5 rounded-full bg-muted-foreground/45' />
                          Closed {formatRelativeTime(stream.closedAt ?? stream.updatedAt)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </aside>

        <div className='flex min-h-0 min-w-0 flex-col'>
          {currentStream ? (
            <div className='flex h-12 shrink-0 items-center justify-between gap-3 border-b border-border/70 px-3 lg:hidden'>
              <div className='min-w-0 flex-1'>
                {executionStreams.length > 1 ? (
                  <label className='block'>
                    <span className='sr-only'>Selected Session</span>
                    <select
                      aria-label='Selected Session'
                      className='h-7 w-full truncate rounded-md border border-border bg-background px-2 text-xs font-medium'
                      value={currentStream.id}
                      onChange={event => {
                        const stream = executionStreams.find(
                          candidate => candidate.id === event.target.value,
                        );
                        if (stream) selectStream(stream);
                      }}
                    >
                      {openStreams.map(stream => (
                        <option key={stream.id} value={stream.id}>
                          {stream.title}
                        </option>
                      ))}
                      {recentStreams.map(stream => (
                        <option key={stream.id} value={stream.id}>
                          {stream.title} (closed)
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <div className='truncate text-sm font-medium'>{currentStream.title}</div>
                )}
                <div className='inline-flex items-center gap-1.5 text-[10px] text-muted-foreground'>
                  <span
                    className={cn(
                      'size-1.5 rounded-full',
                      currentStream.status === 'open'
                        ? 'bg-emerald-500'
                        : 'bg-muted-foreground/45',
                    )}
                  />
                  {currentStream.status === 'open' ? 'Open' : 'Closed'}
                </div>
              </div>
              {currentStream.status === 'open' ? (
                <button
                  type='button'
                  aria-label={`Close ${currentStream.title}`}
                  title='Close stream'
                  className='grid size-8 shrink-0 place-items-center rounded-md border border-border text-muted-foreground hover:bg-muted hover:text-foreground'
                  disabled={closing}
                  onClick={() => setConfirmingClose(true)}
                >
                  <Archive aria-hidden='true' className='size-4' />
                </button>
              ) : null}
            </div>
          ) : null}

          <div className='grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_minmax(180px,0.65fr)] md:grid-cols-[minmax(0,1fr)_320px] md:grid-rows-1 xl:grid-cols-[minmax(0,1fr)_360px]'>
            <section className='flex min-h-0 min-w-0 flex-col' aria-label='Execution tree'>
              <header className='flex min-h-14 shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border/70 px-3 py-2 sm:px-4'>
                <h2 className='text-sm font-semibold'>Plan tree</h2>
                {currentStream ? (
                  <div className='flex items-center gap-1.5'>
                    {currentStream.status === 'open' ? (
                      <>
                        <button
                          type='button'
                          className='inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground'
                          onClick={openForkDialog}
                        >
                          <GitFork aria-hidden='true' className='size-3.5' />
                          Fork session
                        </button>
                        <button
                          type='button'
                          className='inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground'
                          onClick={copySessionInstructions}
                        >
                          {copiedSessionId === currentStream.id ? (
                            <Check aria-hidden='true' className='size-3.5 text-emerald-500' />
                          ) : (
                            <Copy aria-hidden='true' className='size-3.5' />
                          )}
                          {copiedSessionId === currentStream.id ? 'Copied' : 'Copy for LLM'}
                        </button>
                        <button
                          type='button'
                          aria-label={`Close ${currentStream.title}`}
                          className='grid size-7 place-items-center rounded-md border border-border text-muted-foreground hover:bg-muted hover:text-foreground'
                          disabled={closing}
                          onClick={() => setConfirmingClose(true)}
                        >
                          <Archive aria-hidden='true' className='size-3.5' />
                        </button>
                      </>
                    ) : null}
                    <button
                      type='button'
                      aria-pressed={hideDone}
                      className={cn(
                        'rounded-md border px-2.5 py-1.5 text-[11px] font-medium transition-colors',
                        hideDone
                          ? 'border-primary/45 bg-primary/10 text-foreground'
                          : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground',
                      )}
                      onClick={() => setHideDone(current => !current)}
                    >
                      Hide done
                    </button>
                    {collapsibleNodeIds.length > 0 ? (
                      <button
                        type='button'
                        className='rounded-md border border-border px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground'
                        onClick={toggleAllBranches}
                      >
                        {hasCollapsedBranches ? 'Expand all' : 'Collapse all'}
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </header>

              {currentStream?.forkedFromStream ? (
                <div className='border-b border-border/70 px-4 py-2 text-[11px] text-muted-foreground'>
                  Forked from{' '}
                  <span className='font-medium text-foreground'>
                    {currentStream.forkedFromStream.title}
                  </span>
                </div>
              ) : null}
              {copyError ? (
                <p
                  className='border-b border-border/70 px-4 py-2 text-xs text-destructive'
                  role='alert'
                >
                  {copyError}
                </p>
              ) : null}

              <div className='min-h-0 flex-1 overflow-y-auto px-2 py-3 sm:px-3'>
                {currentStream ? (
                  treeRows.length > 0 ? (
                    <div className='grid gap-0.5'>
                      {treeRows.map(({ depth, hasChildren, node }) => {
                        const focused = node.id === currentStream.currentFocusPlan?.id;
                        const collapsed = collapsedNodeIds.has(node.id);

                        return (
                          <div
                            key={node.id}
                            className={cn(
                              'grid min-h-12 w-full grid-cols-[24px_minmax(0,1fr)] items-center rounded-lg pr-2 transition-colors hover:bg-muted/55',
                              focused && 'bg-sky-500/10 hover:bg-sky-500/15',
                            )}
                            style={{ paddingLeft: `${4 + Math.min(depth, 6) * 22}px` }}
                          >
                            {hasChildren ? (
                              <button
                                type='button'
                                aria-label={`${collapsed ? 'Expand' : 'Collapse'} ${node.shortTitle}`}
                                aria-expanded={!collapsed}
                                className='grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-background/75 hover:text-foreground'
                                onClick={() => toggleCollapsedNode(node.id)}
                              >
                                {collapsed ? (
                                  <ChevronRight aria-hidden='true' className='size-3.5' />
                                ) : (
                                  <ChevronDown aria-hidden='true' className='size-3.5' />
                                )}
                              </button>
                            ) : (
                              <span aria-hidden='true' />
                            )}
                            <button
                              type='button'
                              className='grid min-w-0 grid-cols-[20px_minmax(0,1fr)_auto] items-center gap-2 py-2 text-left'
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
                              <span className='pl-2 text-[11px] text-muted-foreground'>
                                {focused ? 'focus' : node.statusGroup}
                              </span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className='px-3 py-8 text-sm text-muted-foreground'>
                      {hideDone
                        ? 'All Plans in this stream are done and hidden.'
                        : 'The referenced Plans are not in the current projection.'}
                    </p>
                  )
                ) : (
                  <div className='grid h-full min-h-48 place-items-center px-6 py-10 text-center'>
                    <div className='max-w-md'>
                      <span className='mx-auto grid size-10 place-items-center rounded-xl bg-muted text-muted-foreground'>
                        <Archive aria-hidden='true' className='size-4' />
                      </span>
                      <h2 className='mt-4 text-base font-semibold'>No Session yet</h2>
                      <p className='mt-2 text-sm leading-6 text-muted-foreground'>
                        Atlas is waiting for your next attributable merged Pull Request.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </section>

            <aside className='flex min-h-0 flex-col border-t border-border/70 bg-muted/10 md:border-l md:border-t-0'>
              <header className='flex h-14 shrink-0 items-center justify-between border-b border-border/70 px-4'>
                <h2 className='text-sm font-semibold'>Merged PRs</h2>
                <span className='font-mono text-[10px] text-muted-foreground'>
                  {currentStream?.activities.length ?? 0}
                </span>
              </header>
              <div className='min-h-0 flex-1 overflow-y-auto px-4 py-4'>
                {currentStream?.activities.length ? (
                  <ol className='grid gap-5'>
                    {currentStream.activities.map(activity => (
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
                  <p className='text-sm text-muted-foreground'>No recorded activity.</p>
                )}
              </div>
            </aside>
          </div>
        </div>
      </div>

      {confirmingFork && currentStream ? (
        <div
          className='fixed inset-0 z-[90] grid place-items-center bg-background/75 px-4 backdrop-blur-sm'
          onMouseDown={event => {
            if (event.target === event.currentTarget && !forking) {
              setConfirmingFork(false);
            }
          }}
        >
          <section
            role='dialog'
            aria-modal='true'
            aria-labelledby='fork-execution-stream-title'
            className='flex max-h-[min(760px,calc(100vh-2rem))] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-border bg-background shadow-2xl'
          >
            <div className='flex items-start justify-between gap-3 border-b border-border p-5'>
              <div>
                <h2 id='fork-execution-stream-title' className='text-lg font-semibold'>
                  Fork “{currentStream.title}”
                </h2>
                <p className='mt-2 text-sm leading-6 text-muted-foreground'>
                  Select the Plan branches that continue in a separate Session. Existing PR
                  history stays here.
                </p>
              </div>
              <button
                type='button'
                aria-label='Cancel fork'
                className='grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground'
                disabled={forking}
                onClick={() => setConfirmingFork(false)}
              >
                <X aria-hidden='true' className='size-4' />
              </button>
            </div>

            <div className='min-h-0 flex-1 overflow-y-auto p-5'>
              <label className='grid gap-1.5 text-sm font-medium'>
                Session name
                <input
                  className='h-10 rounded-lg border border-border bg-background px-3 font-normal outline-none focus:border-sky-500'
                  value={forkTitle}
                  onChange={event => setForkTitle(event.target.value)}
                />
              </label>
              <fieldset className='mt-5'>
                <legend className='text-sm font-medium'>Plans to continue</legend>
                <div className='mt-2 grid gap-1 rounded-lg border border-border p-2'>
                  {forkTreeRows.map(({ depth, node }) => (
                    <label
                      key={node.id}
                      className='flex min-h-10 cursor-pointer items-center gap-2 rounded-md px-2 hover:bg-muted/55'
                      style={{ paddingLeft: `${8 + Math.min(depth, 6) * 18}px` }}
                    >
                      <input
                        type='checkbox'
                        checked={forkPlanIds.has(node.id)}
                        onChange={() => toggleForkPlan(node.id)}
                      />
                      <span className='min-w-0 flex-1 truncate text-sm'>{node.shortTitle}</span>
                      <span className='text-[11px] text-muted-foreground'>{node.statusGroup}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              {forkError ? (
                <p className='mt-3 text-sm text-destructive' role='alert'>
                  {forkError}
                </p>
              ) : null}
            </div>

            <div className='flex justify-end gap-2 border-t border-border p-4'>
              <button
                type='button'
                className='rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted'
                disabled={forking}
                onClick={() => setConfirmingFork(false)}
              >
                Cancel
              </button>
              <button
                type='button'
                className='inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60'
                disabled={forking || forkPlanIds.size === 0 || forkTitle.trim().length === 0}
                onClick={createFork}
              >
                {forking ? (
                  <Loader2 aria-hidden='true' className='size-4 animate-spin' />
                ) : (
                  <GitFork aria-hidden='true' className='size-4' />
                )}
                Create Session
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {confirmingClose && currentStream?.status === 'open' ? (
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
                  {currentStream.mode === 'implicit'
                    ? 'Plans keep their current status. The next attributable untagged merge starts a new implicit Session automatically.'
                    : 'Plans keep their current status. Future PRs naming this Session no longer route to another Session automatically.'}
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
