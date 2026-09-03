import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AtlasExecutionStreamProjection } from '../model/execution-stream';
import type { PlanWorkstreamSnapshot } from '../model/snapshot';

const refreshMock = vi.hoisted(() => vi.fn());
const closeExecuteAsyncMock = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));
vi.mock('@ontahi/react/graph', () => ({
  useOperation: () => ({
    executeAsync: closeExecuteAsyncMock,
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
  closedAt: null,
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

describe('ExecutionStreamView', () => {
  beforeEach(() => {
    refreshMock.mockReset();
    closeExecuteAsyncMock.mockReset().mockResolvedValue({
      ok: true,
      kind: 'success',
      value: {
        id: currentStream.id,
        closed: true,
        closedAt: '2026-09-03T02:00:00.000Z',
      },
    });
  });

  it('renders the waiting state without reconstructing a stream', () => {
    render(
      <ExecutionStreamView executionStreams={[]} onOpenPlan={vi.fn()} snapshot={snapshot} />,
    );

    expect(screen.getByRole('heading', { name: 'No open stream' })).toBeInTheDocument();
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

    expect(screen.getByRole('heading', { name: 'Current stream' })).toBeInTheDocument();
    expect(screen.getByText('PR #24 merged')).toBeInTheDocument();
    expect(screen.getByText('focus')).toBeInTheDocument();
    expect(screen.getByText('Persistent Identity')).toBeInTheDocument();
    expect(screen.getByText('done')).toBeInTheDocument();
    expect(screen.getByText('Earlier identity work')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Explicit Routing/ }));
    expect(onOpenPlan).toHaveBeenCalledWith('plan:atlas://plans/125-routing');
  });

  it('confirms and closes the current stream through the bridged operation', async () => {
    render(
      <ExecutionStreamView
        executionStreams={[currentStream]}
        onOpenPlan={vi.fn()}
        snapshot={snapshot}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Close stream' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/Plans keep their current status/)).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Close stream' }));

    await waitFor(() =>
      expect(closeExecuteAsyncMock).toHaveBeenCalledWith({ id: currentStream.id }),
    );
    await waitFor(() => expect(refreshMock).toHaveBeenCalledOnce());
  });
});
