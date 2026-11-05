import { Effect } from 'effect';
import { withInvocationContext } from '@ontahi/core/runtime/server';
import { describe, expect, it, vi } from 'vitest';

import { createAtlasOntahiApplication } from './atlas-application';
import { ATLAS_GITHUB_REPOSITORY_DISCOVERY_RESOURCE } from '../github/user-repositories';

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

describe('AtlasWorkspace.delete', () => {
  it('requires the exact slug and deletes the owner Workspace aggregate', async () => {
    const workspaceDeleted = vi.fn(() => Effect.void);
    const atlas = createAtlasOntahiApplication([], {
      workspaceDeleted,
      workspaceRoleFor: () => Effect.succeed('owner'),
    });
    const create = atlas.application.graph.entities.AtlasWorkspace.domain.create;
    const remove = atlas.application.graph.entities.AtlasWorkspace.domain.delete;
    const created = await withInvocationContext(principal, () =>
      atlas.application.invokeOperation(create, { name: 'Acme', slug: 'acme' }),
    );
    if (!created.ok) throw new Error('Workspace fixture was not created.');
    const createdWorkspace = created.value as { id: string };

    await expect(
      withInvocationContext(principal, () =>
        atlas.application.invokeOperation(remove, {
          workspace: { id: createdWorkspace.id },
          confirmationSlug: 'wrong',
        }),
      ),
    ).resolves.toMatchObject({
      ok: false,
      failure: { reason: 'workspace_confirmation_mismatch' },
    });

    await expect(
      withInvocationContext(principal, () =>
        atlas.application.invokeOperation(remove, {
          workspace: { id: createdWorkspace.id },
          confirmationSlug: 'acme',
        }),
      ),
    ).resolves.toMatchObject({
      ok: true,
      value: { id: createdWorkspace.id, slug: 'acme' },
    });
    expect(workspaceDeleted).toHaveBeenCalledWith({
      userId: 'user-1',
      workspaceId: createdWorkspace.id,
    });

    await expect(
      withInvocationContext(principal, () =>
        atlas.application.invokeOperation(create, { name: 'Acme Again', slug: 'acme' }),
      ),
    ).resolves.toMatchObject({ ok: true });
  });

  it('rejects deletion by a non-owner', async () => {
    const atlas = createAtlasOntahiApplication([], {
      workspaceRoleFor: () => Effect.succeed('viewer'),
    });
    const remove = atlas.application.graph.entities.AtlasWorkspace.domain.delete;

    await expect(
      withInvocationContext(principal, () =>
        atlas.application.invokeOperation(remove, {
          workspace: { id: workspaceId },
          confirmationSlug: 'atlas',
        }),
      ),
    ).resolves.toMatchObject({
      ok: false,
      failure: { reason: 'workspace_owner_required' },
    });
  });
});

describe('AtlasWorkspace.registerSource', () => {
  it('lists only repositories supplied by the authenticated provider resource', async () => {
    const atlas = createAtlasOntahiApplication([], {
      workspaceRoleFor: () => Effect.succeed('owner'),
    });
    const operation = atlas.application.graph.entities.AtlasWorkspace.domain.listRepositories;
    const context = {
      principal: { issuer: 'atlas', kind: 'user', subject: 'user-1' },
      resources: new Map([[ATLAS_GITHUB_REPOSITORY_DISCOVERY_RESOURCE, {
        list: () => Promise.resolve({
          authorizationRequired: false,
          repositories: [{ defaultRef: 'main', fullName: 'acme/product', isPrivate: true }],
        }),
      }]]),
    } as never;

    await expect(
      withInvocationContext(context, () =>
        atlas.application.invokeOperation(operation, { workspace: { id: workspaceId } }),
      ),
    ).resolves.toMatchObject({
      ok: true,
      value: {
        authorizationRequired: false,
        repositories: [{ fullName: 'acme/product' }],
      },
    });
  });

  it('lets an owner register a GitHub repository after server validation', async () => {
    const atlas = createAtlasOntahiApplication([], {
      workspaceRoleFor: () => Effect.succeed('owner'),
    });
    const operation = atlas.application.graph.entities.AtlasWorkspace.domain.registerSource;
    const ownerContext = {
      principal: { issuer: 'atlas', kind: 'user', subject: 'user-1' },
      resources: new Map([[ATLAS_GITHUB_REPOSITORY_DISCOVERY_RESOURCE, {
        list: vi.fn().mockResolvedValue({
          authorizationRequired: false,
          repositories: [{ defaultRef: 'trunk', fullName: 'acme/product', isPrivate: true }],
        }),
      }]]),
    } as never;

    const result = await withInvocationContext(ownerContext, () =>
      atlas.application.invokeOperation(operation, {
        workspace: { id: workspaceId },
        repository: 'acme/product',
      }),
    );

    expect(result).toMatchObject({
      ok: true,
      value: { repository: 'acme/product', ref: 'trunk', sourceId: 'product' },
    });
  });

  it('rejects non-owners and duplicate repositories', async () => {
    const viewerAtlas = createAtlasOntahiApplication([], {
      workspaceRoleFor: () => Effect.succeed('viewer'),
    });
    const viewerOperation = viewerAtlas.application.graph.entities.AtlasWorkspace.domain.registerSource;
    await expect(
      withInvocationContext(principal, () =>
        viewerAtlas.application.invokeOperation(viewerOperation, {
          workspace: { id: workspaceId },
          repository: 'acme/product',
        }),
      ),
    ).resolves.toMatchObject({ ok: false, failure: { reason: 'workspace_owner_required' } });

    const ownerAtlas = createAtlasOntahiApplication([], {
      workspaceRoleFor: () => Effect.succeed('owner'),
    });
    const ownerOperation = ownerAtlas.application.graph.entities.AtlasWorkspace.domain.registerSource;
    const ownerContext = {
      principal: { issuer: 'atlas', kind: 'user', subject: 'user-1' },
      resources: new Map([[ATLAS_GITHUB_REPOSITORY_DISCOVERY_RESOURCE, {
        list: () => Promise.resolve({
          authorizationRequired: false,
          repositories: [{ defaultRef: 'main', fullName: 'acme/product', isPrivate: false }],
        }),
      }]]),
    } as never;
    const invoke = () =>
      withInvocationContext(ownerContext, () =>
        ownerAtlas.application.invokeOperation(ownerOperation, {
          workspace: { id: workspaceId },
          repository: 'acme/product',
        }),
      );
    await expect(invoke()).resolves.toMatchObject({ ok: true });
    await expect(invoke()).resolves.toMatchObject({
      ok: false,
      failure: { reason: 'workspace_source_exists' },
    });
    await expect(
      withInvocationContext(ownerContext, () =>
        ownerAtlas.application.invokeOperation(ownerOperation, {
          workspace: { id: workspaceId },
          repository: 'someone-else/forged',
        }),
      ),
    ).resolves.toMatchObject({ ok: false, failure: { reason: 'repository_unavailable' } });
  });
});
