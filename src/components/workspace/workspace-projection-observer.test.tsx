import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const refresh = vi.hoisted(() => vi.fn());
const useGraphQuery = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));
vi.mock('@ontahi/react/graph', () => ({ useGraphQuery }));

import { WorkspaceProjectionObserver } from './workspace-projection-observer';

describe('WorkspaceProjectionObserver', () => {
  beforeEach(() => {
    refresh.mockReset();
    useGraphQuery.mockReset();
  });

  it('refreshes automatically in development when the accepted revision advances', async () => {
    useGraphQuery.mockReturnValue({ data: [{ id: 'revision-1' }] });
    const view = render(<WorkspaceProjectionObserver renderedRevisionId='revision-1' autoRefresh />);
    expect(refresh).not.toHaveBeenCalled();

    useGraphQuery.mockReturnValue({ data: [{ id: 'revision-2' }] });
    view.rerender(<WorkspaceProjectionObserver renderedRevisionId='revision-1' autoRefresh />);

    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
  });

  it('does not refresh while polling the same revision', () => {
    useGraphQuery.mockReturnValue({ data: [{ id: 'revision-1' }] });
    const view = render(<WorkspaceProjectionObserver renderedRevisionId='revision-1' />);
    view.rerender(<WorkspaceProjectionObserver renderedRevisionId='revision-1' />);

    expect(refresh).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Reload' })).not.toBeInTheDocument();
  });

  it('keeps the notice visible until the page renders the newer revision', () => {
    useGraphQuery.mockReturnValue({ data: [{ id: 'revision-2' }] });
    const view = render(<WorkspaceProjectionObserver renderedRevisionId='revision-1' />);
    expect(useGraphQuery).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      refetchOnWindowFocus: 'always',
      refetchIntervalInBackground: false,
    }));
    expect(refresh).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }));
    expect(refresh).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
    view.rerender(<WorkspaceProjectionObserver renderedRevisionId='revision-2' />);
    expect(screen.queryByRole('button', { name: 'Reload' })).not.toBeInTheDocument();
  });
});
