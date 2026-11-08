import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const refresh = vi.hoisted(() => vi.fn());
const useRuntimeTransportCapability = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));
vi.mock('@ontahi/react/graph', () => ({ useRuntimeTransportCapability }));

import { WorkspaceSyncActivity } from './workspace-sync-activity';

describe('WorkspaceSyncActivity', () => {
  beforeEach(() => {
    refresh.mockReset();
    useRuntimeTransportCapability.mockReset().mockReturnValue(undefined);
  });

  it('renders a subject-discovered running Task without a manual refresh affordance', () => {
    render(
      <WorkspaceSyncActivity
        runs={[{
          createdAt: '2026-11-08T12:00:00.000Z',
          runId: 'run-1',
          status: 'running',
          taskId: 'atlas.workspace.reconcile-sources',
          trigger: { cause: 'external_event', source: { event: 'pull_request', provider: 'github' } },
          updatedAt: '2026-11-08T12:00:01.000Z',
        }]}
      />,
    );

    expect(screen.getByText('Workspace is syncing')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Refresh Workspace sync status' }),
    ).not.toBeInTheDocument();
  });

  it('re-observes a discovered run and refreshes the projection when it completes', async () => {
    useRuntimeTransportCapability.mockReturnValue({
      durableOperation: {
        observe: async function* () {
          yield {
            completedAt: '2026-11-08T12:00:02.000Z',
            runId: 'run-1',
            status: 'completed',
            taskId: 'atlas.workspace.reconcile-sources',
            updatedAt: '2026-11-08T12:00:02.000Z',
          };
        },
      },
    });

    render(
      <WorkspaceSyncActivity
        runs={[{
          createdAt: '2026-11-08T12:00:00.000Z',
          runId: 'run-1',
          status: 'running',
          taskId: 'atlas.workspace.reconcile-sources',
          trigger: { cause: 'user_request' },
          updatedAt: '2026-11-08T12:00:01.000Z',
        }]}
      />,
    );

    expect(await screen.findByText('Workspace updated')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Refresh Workspace sync status' }),
    ).not.toBeInTheDocument();
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
  });
});
