import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const useGraphQueryMock = vi.hoisted(() => vi.fn());
const useOperationMock = vi.hoisted(() => vi.fn());

vi.mock('@ontahi/react/graph', () => ({
  useGraphQuery: useGraphQueryMock,
  useOperation: useOperationMock,
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
    useOperationMock.mockReset();
    useOperationMock.mockReturnValue({
      executeAsync: vi.fn().mockResolvedValue({
        ok: true,
        value: { id: 'workspace-1', visibility: 'public' },
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

  it('renders only memberships returned by the authorized Graph Query', () => {
    const workspaceRefetch = vi.fn().mockResolvedValue(undefined);
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
          refetch: workspaceRefetch,
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

    render(<WorkspaceSettings viewer={viewer} />);

    expect(screen.getByRole('heading', { name: 'Atlas' })).toBeInTheDocument();
    expect(screen.getByText('/atlas · private')).toBeInTheDocument();
    expect(screen.getByText('owner@example.com')).toBeInTheDocument();
    expect(screen.getByText('reader@example.com')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'javifernandes/atlas ↗' })).toHaveAttribute(
      'href',
      'https://github.com/javifernandes/atlas',
    );
    expect(screen.getByText('approval required')).toBeInTheDocument();
    expect(screen.queryByText(/source:/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add repository' })).not.toBeInTheDocument();
    expect(screen.getByText('Connections coming next')).toBeInTheDocument();
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

    fireEvent.change(screen.getByLabelText('Workspace access'), {
      target: { value: 'public' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save visibility' }));

    return waitFor(() => {
      expect(useOperationMock.mock.results[0]?.value.executeAsync).toHaveBeenCalledWith({
        workspace: { id: 'workspace-1' },
        visibility: 'public',
      });
      expect(workspaceRefetch).toHaveBeenCalledOnce();
    });
  });
});
