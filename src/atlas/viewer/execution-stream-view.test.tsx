import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AtlasExecutionStreamProjection } from '../model/execution-stream';
import type { PlanWorkstreamSnapshot } from '../model/snapshot';

const refreshMock = vi.hoisted(() => vi.fn());
const replaceMock = vi.hoisted(() => vi.fn());
const closeExecuteAsyncMock = vi.hoisted(() => vi.fn());
const forkExecuteAsyncMock = vi.hoisted(() => vi.fn());
const setArchivedExecuteAsyncMock = vi.hoisted(() => vi.fn());
const clipboardWriteTextMock = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: refreshMock, replace: replaceMock }),
}));
vi.mock('@ontahi/react/graph', () => ({
  useOperation: (operation: { id: string }) => ({
    executeAsync: operation.id.endsWith('.fork')
      ? forkExecuteAsyncMock
      : operation.id.endsWith('.setArchived')
        ? setArchivedExecuteAsyncMock
      : closeExecuteAsyncMock,
    isExecuting: false,
  }),
}));

import { ExecutionStreamView } from './execution-stream-view';

const snapshot: PlanWorkstreamSnapshot = {
  generatedAt: '2026-09-03T00:00:00.000Z',
  metrics: [],
  territories: [],
  nodes: [
    {
      id: 'plan:atlas://plans/124-streams',
      kind: 'plan',
      title: 'Implicit Streams',
      shortTitle: 'Implicit Streams',
      statusGroup: 'current',
      status: 'current',
      territory: 'Atlas',
      path: 'atlas://plans/124-streams',
      sections: [],
      relatedCount: 0,
      candidateCount: 0,
    },
    {
      id: 'plan:atlas://plans/125-routing',
      kind: 'plan',
      title: 'Explicit Routing',
      shortTitle: 'Explicit Routing',
      statusGroup: 'next',
      status: 'next',
      territory: 'Atlas',
      path: 'atlas://plans/125-routing',
      sections: [],
      relatedCount: 0,
      candidateCount: 0,
    },
    {
      id: 'plan:atlas://plans/123-identity',
      kind: 'plan',
      title: 'Persistent Identity',
      shortTitle: 'Persistent Identity',
      statusGroup: 'done',
      status: 'done',
      territory: 'Atlas',
      path: 'atlas://plans/123-identity',
      sections: [],
      relatedCount: 0,
      candidateCount: 0,
    },
  ],
  edges: [
    {
      id: 'streams-routing',
      from: 'plan:atlas://plans/124-streams',
      to: 'plan:atlas://plans/125-routing',
      kind: 'contains',
    },
    {
      id: 'streams-identity',
      from: 'plan:atlas://plans/124-streams',
      to: 'plan:atlas://plans/123-identity',
      kind: 'contains',
    },
  ],
};

const currentStream: AtlasExecutionStreamProjection = {
  id: '43bd10df-f2cf-4f05-8f1d-3666f5614771',
  mode: 'implicit',
  status: 'open',
  title: 'Implicit Streams',
  openedAt: '2026-09-03T00:00:00.000Z',
  archivedAt: null,
  closedAt: null,
  forkedFromStream: null,
  lastActivityAt: '2026-09-03T01:00:00.000Z',
  updatedAt: '2026-09-03T01:00:00.000Z',
  roots: [
    {
      id: 'plan:atlas://plans/124-streams',
      path: 'atlas://plans/124-streams',
      status: 'current',
      title: 'Implicit Streams',
    },
  ],
  currentFocusPlan: {
    id: 'plan:atlas://plans/125-routing',
    path: 'atlas://plans/125-routing',
    status: 'next',
    title: 'Explicit Routing',
  },
  activities: [
    {
      id: 'activity-1',
      attribution: 'implicit-single-open',
      kind: 'pull-request-merged',
      occurredAt: '2026-09-03T01:00:00.000Z',
      plan: {
        id: 'plan:atlas://plans/125-routing',
        path: 'atlas://plans/125-routing',
        status: 'next',
        title: 'Explicit Routing',
      },
      pullRequest: {
        authorLogin: 'javi',
        mergedAt: '2026-09-03T01:00:00.000Z',
        number: 24,
        repositoryFullName: 'javifernandes/atlas',
        title: 'Start implicit streams',
        url: 'https://github.com/javifernandes/atlas/pull/24',
      },
    },
  ],
};

const recentStream: AtlasExecutionStreamProjection = {
  ...currentStream,
  id: '8dc3c55f-903e-4f68-8561-b27710b07aa5',
  status: 'closed',
  title: 'Earlier identity work',
  closedAt: '2026-09-02T23:00:00.000Z',
};

const archivedStream: AtlasExecutionStreamProjection = {
  ...recentStream,
  id: '67706869-e382-43d8-9e6b-97b48acf2f5c',
  archivedAt: '2026-09-03T03:00:00.000Z',
  title: 'Archived identity work',
};

const explicitStream: AtlasExecutionStreamProjection = {
  ...currentStream,
  id: '0df587f3-130f-454a-9b48-f985beb26de7',
  mode: 'explicit',
  title: 'Secondary lineage',
  forkedFromStream: { id: currentStream.id, title: currentStream.title },
  roots: [
    {
      id: 'plan:atlas://plans/125-routing',
      path: 'atlas://plans/125-routing',
      status: 'next',
      title: 'Explicit Routing',
    },
  ],
  activities: [
    {
      ...currentStream.activities[0]!,
      id: 'activity-2',
      attribution: 'explicit-directive',
      pullRequest: {
        ...currentStream.activities[0]!.pullRequest!,
        number: 25,
        title: 'Route explicit Session work',
        url: 'https://github.com/javifernandes/atlas/pull/25',
      },
    },
  ],
};

describe('ExecutionStreamView', () => {
  beforeEach(() => {
    refreshMock.mockReset();
    replaceMock.mockReset();
    globalThis.history.replaceState({}, '', '/');
    clipboardWriteTextMock.mockReset().mockResolvedValue(undefined);
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      configurable: true,
      value: { writeText: clipboardWriteTextMock },
    });
    closeExecuteAsyncMock.mockReset().mockResolvedValue({
      ok: true,
      kind: 'success',
      value: {
        id: currentStream.id,
        closed: true,
        closedAt: '2026-09-03T02:00:00.000Z',
      },
    });
    forkExecuteAsyncMock.mockReset().mockResolvedValue({
      ok: true,
      kind: 'success',
      value: {
        id: explicitStream.id,
        forkedFromStreamId: currentStream.id,
        rootPlanIds: ['plan:atlas://plans/125-routing'],
        title: explicitStream.title,
      },
    });
    setArchivedExecuteAsyncMock.mockReset().mockResolvedValue({
      ok: true,
      kind: 'success',
      value: {
        id: recentStream.id,
        archived: true,
        archivedAt: '2026-09-03T03:00:00.000Z',
      },
    });
  });

  it('renders the waiting state without reconstructing a stream', () => {
    render(
      <ExecutionStreamView executionStreams={[]} onOpenPlan={vi.fn()} snapshot={snapshot} />,
    );

    expect(screen.getByRole('heading', { name: 'No Session yet' })).toBeInTheDocument();
    expect(screen.getByText(/next attributable merged Pull Request/i)).toBeInTheDocument();
  });

  it('renders the focused Plan, sibling path, and merged activity', () => {
    const onOpenPlan = vi.fn();
    render(
      <ExecutionStreamView
        executionStreams={[currentStream, recentStream]}
        onOpenPlan={onOpenPlan}
        snapshot={snapshot}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Sessions' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Plan tree' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Merged PRs' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Merged pull request' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Start implicit streams' })).toHaveAttribute(
      'href',
      'https://github.com/javifernandes/atlas/pull/24',
    );
    expect(screen.getByRole('link', { name: 'javifernandes/atlas' })).toHaveAttribute(
      'href',
      'https://github.com/javifernandes/atlas',
    );
    expect(screen.getByText(/#24/)).toBeInTheDocument();
    expect(screen.queryByText('PR #24 merged')).not.toBeInTheDocument();
    expect(screen.getByText('Close')).toBeInTheDocument();
    expect(screen.getByText('focus')).toBeInTheDocument();
    expect(screen.getByText('Persistent Identity')).toBeInTheDocument();
    expect(screen.getByText('done')).toBeInTheDocument();
    expect(screen.getByText('Earlier identity work')).toBeInTheDocument();
    expect(screen.getAllByText(/Last PR/).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: /Explicit Routing/ }));
    expect(onOpenPlan).toHaveBeenCalledWith('plan:atlas://plans/125-routing');
  });

  it('filters done Plans and collapses or expands tree branches locally', () => {
    render(
      <ExecutionStreamView
        executionStreams={[currentStream]}
        onOpenPlan={vi.fn()}
        snapshot={snapshot}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Collapse Implicit Streams' }));
    expect(screen.queryByRole('button', { name: /Persistent Identity/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Explicit Routing/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Expand Implicit Streams' }));
    expect(screen.getByRole('button', { name: /Persistent Identity/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Explicit Routing/ })).toBeInTheDocument();

    const hideDone = screen.getByRole('button', { name: 'Hide done' });
    fireEvent.click(hideDone);
    expect(hideDone).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('button', { name: /Persistent Identity/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Explicit Routing/ })).toBeInTheDocument();
  });

  it('switches simultaneous Sessions and copies the selected Session instructions', async () => {
    render(
      <ExecutionStreamView
        executionStreams={[currentStream, explicitStream, recentStream]}
        onOpenPlan={vi.fn()}
        snapshot={snapshot}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Secondary lineage/ }));

    expect(
      screen.getByRole('link', { name: 'Route explicit Session work' }),
    ).toHaveAttribute('href', 'https://github.com/javifernandes/atlas/pull/25');
    expect(screen.getByText(/#25/)).toBeInTheDocument();
    expect(screen.getByText(/Forked from/)).toHaveTextContent('Implicit Streams');

    fireEvent.click(screen.getByRole('button', { name: 'Copy for LLM' }));
    await waitFor(() => expect(clipboardWriteTextMock).toHaveBeenCalledOnce());
    expect(clipboardWriteTextMock.mock.calls[0]?.[0]).toContain(
      `Atlas-Session: ${explicitStream.id}`,
    );
    expect(clipboardWriteTextMock.mock.calls[0]?.[0]).toContain(
      `session=${explicitStream.id}`,
    );
  });

  it('selects multiple visible Plans, filters their review, and forks the exact selection', async () => {
    const { rerender } = render(
      <ExecutionStreamView
        executionStreams={[currentStream]}
        onOpenPlan={vi.fn()}
        snapshot={snapshot}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Select plans' }));
    expect(screen.getByRole('button', { name: 'Fork new Session' })).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Explicit Routing to fork' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Persistent Identity to fork' }));

    fireEvent.click(screen.getByRole('button', { name: 'Fork new Session (2)' }));
    let dialog = screen.getByRole('dialog', { name: /Fork “Implicit Streams”/ });
    expect(within(dialog).getByRole('checkbox', { name: /Explicit Routing/ })).toBeChecked();
    expect(within(dialog).getByRole('checkbox', { name: /Persistent Identity/ })).toBeChecked();
    fireEvent.change(within(dialog).getByRole('searchbox', { name: 'Filter Plans' }), {
      target: { value: 'identity' },
    });
    expect(within(dialog).queryByRole('checkbox', { name: /Explicit Routing/ })).not.toBeInTheDocument();
    expect(within(dialog).getByRole('checkbox', { name: /Persistent Identity/ })).toBeChecked();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fork new Session (2)' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Fork new Session (2)' }));
    dialog = screen.getByRole('dialog', { name: /Fork “Implicit Streams”/ });
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Session name' }), {
      target: { value: 'Protocol follow-up' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create Session' }));

    await waitFor(() =>
      expect(forkExecuteAsyncMock).toHaveBeenCalledWith({
        sourceStreamId: currentStream.id,
        title: 'Protocol follow-up',
        planIds: [
          'plan:atlas://plans/125-routing',
          'plan:atlas://plans/123-identity',
        ],
      }),
    );
    await waitFor(() =>
      expect(replaceMock).toHaveBeenCalledWith(
        `/?view=sessions&session=${explicitStream.id}`,
        { scroll: false },
      ),
    );
    expect(refreshMock).not.toHaveBeenCalled();

    rerender(
      <ExecutionStreamView
        executionStreams={[currentStream, explicitStream]}
        onOpenPlan={vi.fn()}
        snapshot={snapshot}
      />,
    );

    expect(
      screen.getByRole('button', { current: true, name: /Secondary lineage/ }),
    ).toBeInTheDocument();
  });

  it('clears inline fork selection when selection mode is cancelled', () => {
    render(
      <ExecutionStreamView
        executionStreams={[currentStream]}
        onOpenPlan={vi.fn()}
        snapshot={snapshot}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Select plans' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Explicit Routing to fork' }));
    expect(screen.getByRole('button', { name: 'Fork new Session (1)' })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel Plan selection' }));
    expect(screen.queryByRole('checkbox', { name: /to fork/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Select plans' }));
    expect(screen.getByRole('button', { name: 'Fork new Session' })).toBeDisabled();
  });

  it('scopes inline fork selection to the currently selected Session', () => {
    render(
      <ExecutionStreamView
        executionStreams={[currentStream, explicitStream]}
        onOpenPlan={vi.fn()}
        snapshot={snapshot}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Select plans' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Persistent Identity to fork' }));
    fireEvent.click(screen.getByRole('button', { name: /Secondary lineage/ }));

    expect(screen.queryByRole('checkbox', { name: /to fork/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Select plans' }));
    expect(screen.getByRole('checkbox', { name: 'Select Explicit Routing to fork' })).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'Fork new Session' })).toBeDisabled();
  });

  it('confirms and closes the current stream through the bridged operation', async () => {
    render(
      <ExecutionStreamView
        executionStreams={[currentStream]}
        onOpenPlan={vi.fn()}
        snapshot={snapshot}
      />,
    );

    fireEvent.click(screen.getAllByRole('button', { name: `Close ${currentStream.title}` })[0]);
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/Plans keep their current status/)).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Close stream' }));

    await waitFor(() =>
      expect(closeExecuteAsyncMock).toHaveBeenCalledWith({ id: currentStream.id }),
    );
    await waitFor(() => expect(refreshMock).toHaveBeenCalledOnce());
  });

  it('archives an open Session without closing it', async () => {
    render(
      <ExecutionStreamView
        executionStreams={[currentStream, recentStream]}
        onOpenPlan={vi.fn()}
        snapshot={snapshot}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Archive' }));

    await waitFor(() =>
      expect(setArchivedExecuteAsyncMock).toHaveBeenCalledWith({
        id: currentStream.id,
        archived: true,
      }),
    );
    expect(closeExecuteAsyncMock).not.toHaveBeenCalled();
  });

  it('archives closed Sessions and reveals or restores archived history', async () => {
    const { rerender } = render(
      <ExecutionStreamView
        executionStreams={[currentStream, recentStream, archivedStream]}
        onOpenPlan={vi.fn()}
        snapshot={snapshot}
      />,
    );

    expect(screen.queryByRole('button', { name: /Archived identity work/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Show archived/ }));
    fireEvent.click(screen.getByRole('button', { name: /Archived identity work/ }));
    expect(screen.getByRole('button', { name: 'Unarchive' })).toBeInTheDocument();

    setArchivedExecuteAsyncMock.mockResolvedValueOnce({
      ok: true,
      kind: 'success',
      value: { id: archivedStream.id, archived: false, archivedAt: null },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Unarchive' }));
    await waitFor(() =>
      expect(setArchivedExecuteAsyncMock).toHaveBeenCalledWith({
        id: archivedStream.id,
        archived: false,
      }),
    );

    rerender(
      <ExecutionStreamView
        executionStreams={[currentStream, recentStream]}
        onOpenPlan={vi.fn()}
        snapshot={snapshot}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Earlier identity work/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Archive' }));
    await waitFor(() =>
      expect(setArchivedExecuteAsyncMock).toHaveBeenLastCalledWith({
        id: recentStream.id,
        archived: true,
      }),
    );
  });

  it('reveals an archived Session addressed directly by URL', () => {
    globalThis.history.replaceState(
      {},
      '',
      `/?view=sessions&session=${archivedStream.id}`,
    );

    render(
      <ExecutionStreamView
        executionStreams={[currentStream, recentStream, archivedStream]}
        onOpenPlan={vi.fn()}
        snapshot={snapshot}
      />,
    );

    expect(screen.getByRole('button', { name: /Hide archived/ })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Unarchive' })).toBeInTheDocument();
  });

  it('can reveal archived history when no active or recent Session exists', () => {
    render(
      <ExecutionStreamView
        executionStreams={[archivedStream]}
        onOpenPlan={vi.fn()}
        snapshot={snapshot}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Show archived/ }));

    expect(screen.getByRole('button', { name: 'Unarchive' })).toBeInTheDocument();
    expect(globalThis.location.search).toContain(`session=${archivedStream.id}`);
  });
});
