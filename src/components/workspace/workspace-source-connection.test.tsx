import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const registerAsync = vi.hoisted(() => vi.fn());
const reconcileAsync = vi.hoisted(() => vi.fn());
const listAsync = vi.hoisted(() => vi.fn());
const useOperation = vi.hoisted(() => vi.fn());
const linkSocial = vi.hoisted(() => vi.fn());
vi.mock('@ontahi/react/graph', () => ({
  useOperation,
}));
vi.mock('@/auth/client', () => ({
  atlasAuthClient: { linkSocial },
}));

import { WorkspaceSourceConnection } from './workspace-source-connection';

describe('WorkspaceSourceConnection', () => {
  it('offers one GitHub App connection action without another OAuth authorization', async () => {
    let hookCall = 0;
    listAsync.mockResolvedValue({
      ok: true,
      value: {
        connectionRequired: true,
        installationUrl: 'https://github.test/apps/atlas/installations/new',
        repositories: [],
      },
    });
    useOperation.mockImplementation(() => [
      { executeAsync: registerAsync, isExecuting: false },
      { executeAsync: reconcileAsync, isExecuting: false },
      { executeAsync: listAsync, isExecuting: false },
    ][hookCall++ % 3]);
    render(<WorkspaceSourceConnection canManage workspaceId='workspace-1' />);

    const connectLink = await screen.findByRole('link', {
      name: 'Connect GitHub repositories',
    });
    expect(
      screen.queryByRole('link', { name: 'Install or configure the Atlas GitHub App' }),
    ).not.toBeInTheDocument();
    expect(connectLink).toHaveAttribute(
      'href',
      'https://github.test/apps/atlas/installations/new',
    );
    expect(linkSocial).not.toHaveBeenCalled();
  });

  it('registers an owner/repository and refreshes Sources', async () => {
    let hookCall = 0;
    const onConnected = vi.fn().mockResolvedValue(undefined);
    const onContinue = vi.fn();
    registerAsync.mockResolvedValue({
      ok: true,
      value: { id: 'source-1', ref: 'main', repository: 'acme/product', sourceId: 'product' },
    });
    reconcileAsync.mockResolvedValue({
      ok: true,
      value: {
        error: null,
        id: 'import-1',
        observedRevision: 'abc123',
        projectionRevisionId: 'projection-1',
        status: 'completed',
      },
    });
    listAsync.mockResolvedValue({
      ok: true,
      value: {
        connectionRequired: false,
        installationUrl: 'https://github.test/apps/atlas/installations/new',
        repositories: [{ defaultRef: 'main', fullName: 'acme/product', installationId: 'installation-1', isPrivate: true }],
      },
    });
    useOperation.mockImplementation(() => [
      { executeAsync: registerAsync, isExecuting: false },
      { executeAsync: reconcileAsync, isExecuting: false },
      { executeAsync: listAsync, isExecuting: false },
    ][hookCall++ % 3]);
    render(
      <WorkspaceSourceConnection
        canManage
        onConnected={onConnected}
        onContinue={onContinue}
        workspaceId='workspace-1'
      />,
    );

    expect(
      await screen.findByRole('link', { name: 'Install or configure the Atlas GitHub App' }),
    ).toBeInTheDocument();

    fireEvent.click(await screen.findByRole('button', { name: 'Add' }));

    await waitFor(() => {
      expect(registerAsync).toHaveBeenCalledWith({
        workspace: { id: 'workspace-1' },
        repository: 'acme/product',
      });
      expect(onConnected).toHaveBeenCalledOnce();
      expect(reconcileAsync).toHaveBeenCalledWith({
        workspace: { id: 'workspace-1' },
        triggerSourceId: 'source-1',
        trigger: 'connection',
      });
      expect(screen.getByRole('button', { name: 'Added' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(onContinue).toHaveBeenCalledWith(['acme/product']);
  });
});
