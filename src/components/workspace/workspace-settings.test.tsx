import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const useGraphQueryMock = vi.hoisted(() => vi.fn());
const useOperationMock = vi.hoisted(() => vi.fn());
const pushMock = vi.hoisted(() => vi.fn());
const refreshMock = vi.hoisted(() => vi.fn());

vi.mock('@ontahi/react/graph', () => ({
  useGraphQuery: useGraphQueryMock,
  useOperation: useOperationMock,
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
}));

import { WorkspaceSettings } from './workspace-settings';

const viewer = {
  email: 'owner@example.com',
  id: 'user-1',
  image: null,
  name: 'Owner',
};

const queryResult = (overrides: Record<string, unknown> = {}) => ({
  data: undefined,
  isError: false,
  isLoading: false,
  refetch: vi.fn(),
  ...overrides,
});

describe('WorkspaceSettings', () => {
  beforeEach(() => {
    useGraphQueryMock.mockReset();
    useGraphQueryMock.mockReturnValue(queryResult({ data: [] }));
    useOperationMock.mockReset();
    pushMock.mockReset();
    refreshMock.mockReset();
    useOperationMock.mockReturnValue({
      executeAsync: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          connectionRequired: false,
          id: 'workspace-1',
          repositories: [],
          visibility: 'public',
        },
      }),
      isExecuting: false,
    });
  });

  it('renders a loading state while the authorized Graph Query is pending', () => {
    useGraphQueryMock.mockReturnValue(queryResult({ isLoading: true }));

    render(<WorkspaceSettings viewer={viewer} />);

    expect(screen.getByLabelText('Loading workspace settings')).toBeInTheDocument();
  });

  it('offers to retry a failed Graph Query', () => {
    const workspaceRefetch = vi.fn();
    const membersRefetch = vi.fn();
    useGraphQueryMock
      .mockReturnValueOnce(queryResult({ isError: true, refetch: workspaceRefetch }))
      .mockReturnValueOnce(queryResult({ refetch: membersRefetch }))
      .mockReturnValueOnce(queryResult())
      .mockReturnValueOnce(queryResult());

    render(<WorkspaceSettings viewer={viewer} />);
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(screen.getByRole('heading', { name: 'Settings unavailable' })).toBeInTheDocument();
    expect(workspaceRefetch).toHaveBeenCalledOnce();
    expect(membersRefetch).toHaveBeenCalledOnce();
  });

  it('renders the denied state when authority exposes no Workspace', () => {
    useGraphQueryMock
      .mockReturnValueOnce(queryResult({ data: [] }))
      .mockReturnValueOnce(queryResult({ data: [] }))
      .mockReturnValueOnce(queryResult({ data: [] }))
      .mockReturnValueOnce(queryResult({ data: [] }));

    render(<WorkspaceSettings viewer={viewer} />);

    expect(screen.getByRole('heading', { name: 'No active membership' })).toBeInTheDocument();
  });

  it('uses server-resolved owner authority for Source administration', async () => {
    useGraphQueryMock
      .mockReturnValueOnce(queryResult({
        data: [{ id: 'workspace-1', name: 'Acme', slug: 'acme', visibility: 'private' }],
      }))
      .mockReturnValueOnce(queryResult({
        data: [{
          id: 'membership-1', role: 'owner', status: 'active', user: null, userId: viewer.id,
        }],
      }))
      .mockReturnValueOnce(queryResult({ data: [] }))
      .mockReturnValueOnce(queryResult({ data: [] }));

    render(
      <WorkspaceSettings activeSection='sources' viewer={viewer} workspaceRole='owner' />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Add repository' }));
    expect(await screen.findByPlaceholderText('Search your repositories…')).toBeEnabled();
    expect(screen.queryByText('Only a Workspace owner can connect repositories.')).not.toBeInTheDocument();
  });

  it('renders a settings sidebar and only the selected section', () => {
    useGraphQueryMock
      .mockReturnValueOnce(queryResult({
        data: [{ id: 'workspace-1', name: 'Atlas', slug: 'atlas', visibility: 'private' }],
      }))
      .mockReturnValueOnce(queryResult({ data: [{
        id: 'membership-1', role: 'owner', status: 'active', user: viewer, userId: viewer.id,
      }] }))
      .mockReturnValueOnce(queryResult({ data: [] }))
      .mockReturnValueOnce(queryResult({ data: [] }))
      .mockReturnValueOnce(queryResult({ data: [] }));

    render(<WorkspaceSettings viewer={viewer} />);

    expect(screen.getByRole('link', { name: /General/ })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: /Sources/ })).toHaveAttribute(
      'href',
      '/w/atlas/settings?section=sources',
    );
    expect(screen.getByRole('heading', { name: 'Visibility' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Danger Zone' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Sources' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Members' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Danger Zone/ })).not.toBeInTheDocument();
  });

  it('updates visibility from the General section', async () => {
    const workspaceRefetch = vi.fn().mockResolvedValue(undefined);
    useGraphQueryMock
      .mockReturnValueOnce(queryResult({
        data: [{ id: 'workspace-1', name: 'Atlas', slug: 'atlas', visibility: 'private' }],
        refetch: workspaceRefetch,
      }))
      .mockReturnValueOnce(queryResult({ data: [{
        id: 'membership-1', role: 'owner', status: 'active', user: viewer, userId: viewer.id,
      }] }))
      .mockReturnValueOnce(queryResult({ data: [] }))
      .mockReturnValueOnce(queryResult({ data: [] }))
      .mockReturnValueOnce(queryResult({ data: [] }));

    render(<WorkspaceSettings viewer={viewer} />);

    fireEvent.click(screen.getByRole('button', { name: 'Workspace access' }));
    fireEvent.click(screen.getByRole('option', { name: /Public/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Save visibility' }));

    await waitFor(() => {
      expect(useOperationMock.mock.results[0]?.value.executeAsync).toHaveBeenCalledWith({
        workspace: { id: 'workspace-1' },
        visibility: 'public',
      });
      expect(workspaceRefetch).toHaveBeenCalledOnce();
    });
  });

  it('renders only memberships returned by the authorized Graph Query', () => {
    useGraphQueryMock
      .mockReturnValueOnce(
        queryResult({
          data: [
            {
              id: 'workspace-1',
              name: 'Atlas',
              slug: 'atlas',
              visibility: 'private',
            },
          ],
        }),
      )
      .mockReturnValueOnce(
        queryResult({
          data: [
            {
              id: 'membership-2',
              role: 'viewer',
              status: 'active',
              user: { email: 'reader@example.com', id: 'user-2', image: null, name: 'Reader' },
              userId: 'user-2',
            },
            {
              id: 'membership-1',
              role: 'owner',
              status: 'active',
              user: viewer,
              userId: viewer.id,
            },
          ],
        }),
      )
      .mockReturnValueOnce(
        queryResult({
          data: [
            {
              contributorAccess: 'approval-required',
              id: 'source-1',
              provider: 'github',
              ref: 'main',
              repository: 'javifernandes/atlas',
              sourceId: 'atlas',
              status: 'active',
            },
          ],
        }),
      )
      .mockReturnValueOnce(
        queryResult({
          data: [
            {
              avatarUrl: 'https://avatars.example/javi.png',
              contributionCount: 3,
              id: 'contributor-1',
              kind: 'person',
              lastContributedAt: '2026-11-01T00:00:00.000Z',
              linkedUserId: null,
              login: 'javi',
              provider: 'github',
              providerAccountId: '42',
              sourceId: 'atlas',
            },
            {
              avatarUrl: 'https://avatars.example/javifernandes.png',
              contributionCount: 42,
              id: 'contributor-linked-atlas',
              kind: 'person',
              lastContributedAt: '2026-11-01T00:00:00.000Z',
              linkedUserId: viewer.id,
              login: 'javifernandes',
              provider: 'github',
              providerAccountId: '84',
              sourceId: 'atlas',
            },
            {
              avatarUrl: 'https://avatars.example/javifernandes.png',
              contributionCount: 110,
              id: 'contributor-linked-ontahi',
              kind: 'person',
              lastContributedAt: '2026-10-31T00:00:00.000Z',
              linkedUserId: viewer.id,
              login: 'javifernandes',
              provider: 'github',
              providerAccountId: '84',
              sourceId: 'ontahi',
            },
            {
              avatarUrl: 'https://avatars.example/javifernandes.png',
              contributionCount: 3,
              id: 'contributor-linked-bookops',
              kind: 'person',
              lastContributedAt: '2026-09-19T00:00:00.000Z',
              linkedUserId: viewer.id,
              login: 'javifernandes',
              provider: 'github',
              providerAccountId: '84',
              sourceId: 'bookops',
            },
            {
              avatarUrl: null,
              contributionCount: 2,
              id: 'contributor-linked-without-membership',
              kind: 'person',
              lastContributedAt: '2026-10-20T00:00:00.000Z',
              linkedUserId: 'user-3',
              login: 'atlas-friend',
              provider: 'github',
              providerAccountId: '126',
              sourceId: 'atlas',
            },
          ],
        }),
      );

    render(<WorkspaceSettings activeSection='people' viewer={viewer} />);

    expect(screen.getByRole('heading', { name: 'Atlas' })).toBeInTheDocument();
    expect(screen.getByText('/atlas · private')).toBeInTheDocument();
    expect(screen.getByText('owner@example.com')).toBeInTheDocument();
    expect(screen.getByText('reader@example.com')).toBeInTheDocument();
    expect(screen.getAllByText(/@javifernandes/)).toHaveLength(1);
    expect(
      screen.getByText(/155 merged PRs across atlas, bookops, ontahi/),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '@javifernandes' })).toHaveAttribute(
      'href',
      'https://github.com/javifernandes',
    );
    expect(screen.getByText('@javi')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '@javi' })).toHaveAttribute(
      'href',
      'https://github.com/javi',
    );
    expect(screen.getByText(/3 merged PRs across atlas/)).toBeInTheDocument();
    expect(screen.getByText('no Atlas account')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '@atlas-friend' })).toBeInTheDocument();
    expect(screen.getByText('Atlas account linked')).toBeInTheDocument();

  });

  it('renders repository import history with revision, duration, and failure details', () => {
    useGraphQueryMock
      .mockReturnValueOnce(queryResult({
        data: [{ id: 'workspace-1', name: 'Acme', slug: 'acme', visibility: 'private' }],
      }))
      .mockReturnValueOnce(queryResult({ data: [{
        id: 'membership-1', role: 'owner', status: 'active', user: viewer, userId: viewer.id,
      }] }))
      .mockReturnValueOnce(queryResult({ data: [] }))
      .mockReturnValueOnce(queryResult({ data: [] }))
      .mockReturnValueOnce(queryResult({ data: [{
        completedAt: '2026-11-05T12:00:02.000Z',
        diagnosticsJson: '{}',
        error: 'GitHub tree unavailable',
        id: 'import-1',
        observedRevision: 'abc123',
        providerDeliveryId: null,
        pullRequestNumber: null,
        repository: 'acme/product',
        startedAt: '2026-11-05T12:00:00.000Z',
        status: 'failed',
        trigger: 'connection',
        triggerRevision: null,
        triggerSourceId: 'source-1',
      }] }));

    render(
      <WorkspaceSettings activeSection='history' viewer={viewer} workspaceRole='owner' />,
    );

    expect(screen.getByRole('heading', { name: 'Import history' })).toBeInTheDocument();
    expect(screen.getByText('acme/product')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /abc123/ })).toHaveAttribute(
      'href',
      'https://github.com/acme/product/tree/abc123',
    );
    expect(screen.getByText('GitHub tree unavailable')).toBeInTheDocument();
    expect(screen.getByText('failed')).toBeInTheDocument();
  });

  it('requires the exact slug before deleting an owner Workspace', async () => {
    useGraphQueryMock
      .mockReturnValueOnce(queryResult({
        data: [{ id: 'workspace-1', name: 'Acme', slug: 'acme', visibility: 'private' }],
      }))
      .mockReturnValueOnce(queryResult({
        data: [{
          id: 'membership-1', role: 'owner', status: 'active', user: viewer, userId: viewer.id,
        }],
      }))
      .mockReturnValueOnce(queryResult({ data: [] }))
      .mockReturnValueOnce(queryResult({ data: [] }));

    render(
      <WorkspaceSettings viewer={viewer} workspaceRole='owner' />,
    );

    const deleteButton = screen.getByRole('button', { name: 'Delete Workspace' });
    expect(deleteButton).toBeEnabled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(deleteButton);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    const confirmButton = screen.getAllByRole('button', { name: 'Delete Workspace' }).at(-1)!;
    expect(confirmButton).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Type.*acme.*to confirm/), {
      target: { value: 'acme' },
    });
    expect(confirmButton).toBeEnabled();
    fireEvent.click(confirmButton);

    const deleteOperation = useOperationMock.mock.results.at(-1)?.value;
    await waitFor(() => {
      expect(deleteOperation.executeAsync).toHaveBeenCalledWith({
        workspace: { id: 'workspace-1' },
        confirmationSlug: 'acme',
      });
      expect(pushMock).toHaveBeenCalledWith('/');
      expect(refreshMock).toHaveBeenCalledOnce();
    });
  });
});
