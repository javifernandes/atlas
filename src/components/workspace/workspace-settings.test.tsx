import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const useGraphQueryMock = vi.hoisted(() => vi.fn());

vi.mock('@ontahi/react/graph', () => ({ useGraphQuery: useGraphQueryMock }));

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
  beforeEach(() => useGraphQueryMock.mockReset());

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
      .mockReturnValueOnce(queryResult({ refetch: membersRefetch }));

    render(<WorkspaceSettings viewer={viewer} />);
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(screen.getByRole('heading', { name: 'Settings unavailable' })).toBeInTheDocument();
    expect(workspaceRefetch).toHaveBeenCalledOnce();
    expect(membersRefetch).toHaveBeenCalledOnce();
  });

  it('renders the denied state when authority exposes no Workspace', () => {
    useGraphQueryMock
      .mockReturnValueOnce(queryResult({ data: [] }))
      .mockReturnValueOnce(queryResult({ data: [] }));

    render(<WorkspaceSettings viewer={viewer} />);

    expect(screen.getByRole('heading', { name: 'No active membership' })).toBeInTheDocument();
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
      );

    render(<WorkspaceSettings viewer={viewer} />);

    expect(screen.getByRole('heading', { name: 'Atlas' })).toBeInTheDocument();
    expect(screen.getByText('/atlas · private · your role: owner')).toBeInTheDocument();
    expect(screen.getByText('owner@example.com')).toBeInTheDocument();
    expect(screen.getByText('reader@example.com')).toBeInTheDocument();
  });
});
