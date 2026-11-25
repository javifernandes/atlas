import { render, waitFor } from '@testing-library/react';
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

  it('refreshes the server projection when the accepted revision advances', async () => {
    useGraphQuery.mockReturnValue({ data: [{ id: 'revision-1' }] });
    const view = render(<WorkspaceProjectionObserver />);
    expect(refresh).not.toHaveBeenCalled();

    useGraphQuery.mockReturnValue({ data: [{ id: 'revision-2' }] });
    view.rerender(<WorkspaceProjectionObserver />);

    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
  });

  it('does not refresh while polling the same revision', () => {
    useGraphQuery.mockReturnValue({ data: [{ id: 'revision-1' }] });
    const view = render(<WorkspaceProjectionObserver />);
    view.rerender(<WorkspaceProjectionObserver />);

    expect(refresh).not.toHaveBeenCalled();
  });
});
