import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { recordRecentAtlasNode } from '@/atlas/viewer/recent-nodes';

import { WorkspaceControl } from './workspace-control';

const workspace = {
  id: 'workspace-atlas',
  name: 'Atlas',
  role: 'owner' as const,
  slug: 'atlas',
  visibility: 'private' as const,
};

describe('WorkspaceControl', () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      clear: () => values.clear(),
      getItem: (key: string) => values.get(key) ?? null,
      key: () => null,
      length: 0,
      removeItem: (key: string) => values.delete(key),
      setItem: (key: string, value: string) => values.set(key, value),
    } satisfies Storage);
  });

  it('keeps Workspace navigation and recent nodes behind one quiet menu trigger', () => {
    recordRecentAtlasNode({
      href: '/w/atlas?full=interaction-a',
      id: 'interaction-a',
      kind: 'interaction',
      title: 'Respond To Workspace Invitation',
      workspaceSlug: 'atlas',
    });
    render(<WorkspaceControl workspace={workspace} />);

    expect(screen.getByRole('button', { name: 'Open Workspace menu' })).toBeInTheDocument();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Open Workspace menu' }));

    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Search Atlas/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'All Workspaces' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('menuitem', { name: 'Workspace settings' })).toHaveAttribute(
      'href',
      '/w/atlas/settings',
    );
    expect(
      screen.getByRole('menuitem', { name: /Respond To Workspace Invitation/i }),
    ).toHaveAttribute(
      'href', '/w/atlas?full=interaction-a',
    );
    expect(screen.queryByRole('menuitem', { name: 'New Workspace' })).not.toBeInTheDocument();
  });
});
