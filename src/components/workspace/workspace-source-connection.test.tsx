import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const registerAsync = vi.hoisted(() => vi.fn());
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
  it('extends GitHub authorization without starting a new Atlas identity session', async () => {
    let hookCall = 0;
    listAsync.mockResolvedValue({
      ok: true,
      value: { authorizationRequired: true, repositories: [] },
    });
    useOperation.mockImplementation(() =>
      hookCall++ % 2 === 0
        ? { executeAsync: registerAsync, isExecuting: false }
        : { executeAsync: listAsync, isExecuting: false },
    );
    linkSocial.mockResolvedValue({ error: null });
    render(<WorkspaceSourceConnection canManage workspaceId='workspace-1' />);

    fireEvent.click(await screen.findByRole('button', { name: 'Authorize GitHub repositories' }));

    await waitFor(() => {
      expect(linkSocial).toHaveBeenCalledWith({
        callbackURL: globalThis.location.pathname,
        errorCallbackURL: globalThis.location.pathname,
        provider: 'github',
        scopes: ['read:user', 'user:email', 'repo'],
      });
    });
  });

  it('registers an owner/repository and refreshes Sources', async () => {
    let hookCall = 0;
    const onConnected = vi.fn().mockResolvedValue(undefined);
    const onContinue = vi.fn();
    registerAsync.mockResolvedValue({
      ok: true,
      value: { id: 'source-1', ref: 'main', repository: 'acme/product', sourceId: 'product' },
    });
    listAsync.mockResolvedValue({
      ok: true,
      value: {
        authorizationRequired: false,
        repositories: [{ defaultRef: 'main', fullName: 'acme/product', isPrivate: true }],
      },
    });
    useOperation.mockImplementation(() =>
      hookCall++ % 2 === 0
        ? { executeAsync: registerAsync, isExecuting: false }
        : { executeAsync: listAsync, isExecuting: false },
    );
    render(
      <WorkspaceSourceConnection
        canManage
        onConnected={onConnected}
        onContinue={onContinue}
        workspaceId='workspace-1'
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Add' }));

    await waitFor(() => {
      expect(registerAsync).toHaveBeenCalledWith({
        workspace: { id: 'workspace-1' },
        repository: 'acme/product',
      });
      expect(onConnected).toHaveBeenCalledOnce();
      expect(screen.getByRole('button', { name: 'Added' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(onContinue).toHaveBeenCalledWith(['acme/product']);
  });
});
