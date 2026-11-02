import { Effect } from 'effect';
import { withInvocationContext } from '@ontahi/core/runtime/server';
import { describe, expect, it, vi } from 'vitest';

import { createAtlasOntahiApplication } from './atlas-application';

const workspaceId = '00000000-0000-4000-8000-000000000137';
const principal = {
  principal: { issuer: 'atlas', kind: 'user', subject: 'user-1' },
} as never;

describe('AtlasWorkspace.create', () => {
  it('creates a private Workspace and its owner Membership for the authenticated User', async () => {
    const workspaceCreated = vi.fn(() => Effect.void);
    const atlas = createAtlasOntahiApplication([], { workspaceCreated });
    const operation = atlas.application.graph.entities.AtlasWorkspace.domain.create;

    const result = await withInvocationContext(principal, () =>
      atlas.application.invokeOperation(operation, {
        name: 'My Project',
        slug: 'My Project',
      }),
    );

    expect(result, JSON.stringify(result)).toMatchObject({
      ok: true,
      value: { name: 'My Project', slug: 'my-project', visibility: 'private' },
    });
    expect(workspaceCreated).toHaveBeenCalledWith({
      userId: 'user-1',
      workspace: expect.objectContaining({ name: 'My Project', slug: 'my-project' }),
    });
  });

  it('rejects duplicate slugs and anonymous creation', async () => {
    const atlas = createAtlasOntahiApplication([]);
    const operation = atlas.application.graph.entities.AtlasWorkspace.domain.create;
    const input = { name: 'My Project', slug: 'my-project' };

    await expect(
      withInvocationContext(principal, () => atlas.application.invokeOperation(operation, input)),
    ).resolves.toMatchObject({ ok: true });
    await expect(
      withInvocationContext(principal, () => atlas.application.invokeOperation(operation, input)),
    ).resolves.toMatchObject({
      ok: false,
      failure: { reason: 'workspace_slug_taken' },
    });
    await expect(atlas.application.invokeOperation(operation, input)).resolves.toMatchObject({
      ok: false,
      failure: { reason: 'not_authenticated' },
    });
  });
});

describe('AtlasWorkspace.updateVisibility', () => {
  it('lets an active owner update Workspace visibility', async () => {
    const roleFor = vi.fn(() => Effect.succeed<'owner' | null>('owner'));
    const atlas = createAtlasOntahiApplication([], { workspaceRoleFor: roleFor });
    const operation = atlas.application.graph.entities.AtlasWorkspace.domain.updateVisibility;

    const result = await withInvocationContext(principal, () =>
      atlas.application.invokeOperation(operation, {
        workspace: { id: workspaceId },
        visibility: 'public',
      }),
    );

    expect(result).toMatchObject({
      ok: true,
      value: { id: workspaceId, visibility: 'public' },
    });
    expect(roleFor).toHaveBeenCalledWith('user-1', workspaceId);
  });

  it('rejects a non-owner even when the client requests the same mutation', async () => {
    const roleFor = vi.fn(() => Effect.succeed<'viewer' | null>('viewer'));
    const atlas = createAtlasOntahiApplication([], { workspaceRoleFor: roleFor });
    const operation = atlas.application.graph.entities.AtlasWorkspace.domain.updateVisibility;

    await expect(
      withInvocationContext(principal, () =>
        atlas.application.invokeOperation(operation, {
          workspace: { id: workspaceId },
          visibility: 'public',
        }),
      ),
    ).resolves.toMatchObject({
      ok: false,
      failure: { reason: 'workspace_owner_required' },
    });
  });

  it('rejects an invocation without a user principal', async () => {
    const roleFor = vi.fn(() => Effect.succeed<'owner' | null>('owner'));
    const atlas = createAtlasOntahiApplication([], { workspaceRoleFor: roleFor });
    const operation = atlas.application.graph.entities.AtlasWorkspace.domain.updateVisibility;

    await expect(
      atlas.application.invokeOperation(operation, {
        workspace: { id: workspaceId },
        visibility: 'public',
      }),
    ).resolves.toMatchObject({
      ok: false,
      failure: { reason: 'workspace_owner_required' },
    });
    expect(roleFor).not.toHaveBeenCalled();
  });
});
