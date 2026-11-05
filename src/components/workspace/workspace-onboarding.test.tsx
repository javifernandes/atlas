import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const executeAsyncMock = vi.hoisted(() => vi.fn());
const pushMock = vi.hoisted(() => vi.fn());
const refreshMock = vi.hoisted(() => vi.fn());

vi.mock('@ontahi/react/graph', () => ({
  useOperation: () => ({ executeAsync: executeAsyncMock, isExecuting: false }),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
}));

import { WorkspaceOnboarding } from './workspace-onboarding';

describe('WorkspaceOnboarding', () => {
  beforeEach(() => {
    executeAsyncMock.mockReset().mockResolvedValue({
      ok: true,
      value: { id: 'workspace-1', name: 'Acme Plans', slug: 'acme-plans', visibility: 'private' },
    });
    pushMock.mockReset();
    refreshMock.mockReset();
  });

  it('derives a slug and enters the newly created Workspace', async () => {
    render(<WorkspaceOnboarding userName='Ada Lovelace' />);

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Acme Plans' } });
    expect(screen.getByRole('heading', { name: 'Welcome, Ada' })).toBeInTheDocument();
    expect(screen.getByText('/w/acme-plans')).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Address' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Create Workspace' }));

    await waitFor(() => {
      expect(executeAsyncMock).toHaveBeenCalledWith({ name: 'Acme Plans', slug: 'acme-plans' });
      expect(pushMock).toHaveBeenCalledWith('/w/acme-plans');
    });
  });

  it('keeps a creation failure in the onboarding form', async () => {
    executeAsyncMock.mockResolvedValue({ ok: false, message: 'That address is taken.' });
    render(<WorkspaceOnboarding userName='Ada' />);

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Acme' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Workspace' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('That address is taken.');
    expect(pushMock).not.toHaveBeenCalled();
  });
});
