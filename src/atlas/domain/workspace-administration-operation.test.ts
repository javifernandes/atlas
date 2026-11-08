import { query } from '@ontahi/core/data-graph';
import { Effect } from 'effect';
import { withInvocationContext } from '@ontahi/core/runtime/server';
import { describe, expect, it, vi } from 'vitest';

import { createAtlasOntahiApplication } from './atlas-application';
import { ATLAS_GITHUB_REPOSITORY_DISCOVERY_RESOURCE } from '../github/user-repositories';
import { ATLAS_WORKSPACE_SOURCE_RECONCILIATION_RESOURCE } from '../workspace/workspace-source-reconciliation';
import { atlasWorkspaceSourceImportReadPolicy } from '../workspace/workspace-read-policies';

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
        installationUrl: () => Promise.resolve('https://github.test/install'),
        list: () => Promise.resolve({
          connectionRequired: false,
          installationUrl: 'https://github.test/install',
          repositories: [{ defaultRef: 'main', fullName: 'acme/product', installationId: 'installation-1', isPrivate: true }],
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
        connectionRequired: false,
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
        installationUrl: () => Promise.resolve('https://github.test/install'),
        list: vi.fn().mockResolvedValue({
          connectionRequired: false,
          installationUrl: 'https://github.test/install',
          repositories: [{ defaultRef: 'trunk', fullName: 'acme/product', installationId: 'installation-1', isPrivate: true }],
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
        installationUrl: () => Promise.resolve('https://github.test/install'),
        list: () => Promise.resolve({
          connectionRequired: false,
          installationUrl: 'https://github.test/install',
          repositories: [{ defaultRef: 'main', fullName: 'acme/product', installationId: 'installation-1', isPrivate: false }],
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

describe('AtlasWorkspace.reconcileSources', () => {
  const sourceRevision = {
    authority: 'markdown' as const,
    id: 'product:markdown:abc123',
    observedAt: '2026-11-05T12:00:00.000Z',
    repository: 'acme/product',
    revision: 'abc123',
    revisionKind: 'git' as const,
    sourceId: 'product',
  };
  const projection = {
    observedAt: sourceRevision.observedAt,
    snapshot: {
      documents: [],
      edges: [],
      generatedAt: sourceRevision.observedAt,
      metrics: [],
      nodes: [{
        candidateCount: 0,
        id: 'plan:product',
        kind: 'plan' as const,
        relatedCount: 0,
        sections: [],
        shortTitle: 'Product',
        status: 'current',
        statusGroup: 'current' as const,
        territory: 'Product',
        title: 'Product',
      }],
      territories: [],
    },
    sourceRevisionSetHash: 'revision-set-1',
    sourceRevisions: [sourceRevision],
  };

  it('publishes an immutable Workspace projection and records its observed revision', async () => {
    const atlas = createAtlasOntahiApplication([], {
      workspaceRoleFor: () => Effect.succeed('owner'),
    });
    const register = atlas.application.graph.entities.AtlasWorkspace.domain.registerSource;
    const reconcile = atlas.application.graph.entities.AtlasWorkspace.domain.reconcileSources;
    const reconciler = vi.fn().mockResolvedValue(projection);
    const context = {
      principal: { issuer: 'atlas', kind: 'user', subject: 'user-1' },
      resources: new Map<string, unknown>([
        [ATLAS_GITHUB_REPOSITORY_DISCOVERY_RESOURCE, {
          installationUrl: () => Promise.resolve('https://github.test/install'),
          list: () => Promise.resolve({
            connectionRequired: false,
            installationUrl: 'https://github.test/install',
            repositories: [{ defaultRef: 'main', fullName: 'acme/product', installationId: 'installation-1', isPrivate: false }],
          }),
        }],
        [ATLAS_WORKSPACE_SOURCE_RECONCILIATION_RESOURCE, { reconcile: reconciler }],
      ]),
    } as never;
    const registered = await withInvocationContext(context, () =>
      atlas.application.invokeOperation(register, {
        workspace: { id: workspaceId },
        repository: 'acme/product',
      }),
    );
    if (!registered.ok) throw new Error('Source fixture was not registered.');

    const accepted = await withInvocationContext(context, () =>
        atlas.application.invokeOperation(reconcile, {
          workspace: { id: workspaceId },
          triggerSourceId: (registered.value as { id: string }).id,
          trigger: 'connection',
        }),
      );
    expect(accepted).toMatchObject({ ok: true, value: { status: 'queued' } });
    if (!accepted.ok) throw new Error('Reconciliation was not accepted.');
    const acceptedRef = accepted.value as { taskId: string; runId: string };
    await vi.waitFor(async () => {
      await expect(atlas.getWorkspaceSourceTaskRun(acceptedRef)).resolves.toMatchObject({
        result: { observedRevision: 'abc123', status: 'completed' },
        status: 'completed',
      });
    });
    await expect(atlas.listWorkspaceSourceTaskRuns(workspaceId)).resolves.toEqual([
      expect.objectContaining({ runId: acceptedRef.runId, status: 'completed' }),
    ]);
    await expect(atlas.getWorkspaceProjectionSnapshot(workspaceId)).resolves.toMatchObject({
      nodes: [{ id: 'plan:product' }],
    });
    await expect(atlas.getWorkspaceProjectionSnapshot('another-workspace')).resolves.toBeNull();
    await expect(
      atlas.application.graph.read(
        query(atlas.application.graph.entities.AtlasWorkspaceSourceImport)
          .where(sourceImport => sourceImport.workspaceId.eq(workspaceId))
          .select(sourceImport => ({ sourceRevisionsJson: sourceImport.sourceRevisionsJson })),
      ),
    ).resolves.toEqual([{ sourceRevisionsJson: JSON.stringify([sourceRevision]) }]);
    expect(reconciler).toHaveBeenCalledWith({
      workspaceId,
      sources: [{ id: 'product', ref: 'main', repository: 'acme/product' }],
    });

    reconciler.mockRejectedValueOnce(new Error('Temporary GitHub failure'));
    const retry = await withInvocationContext(context, () =>
        atlas.application.invokeOperation(reconcile, {
          workspace: { id: workspaceId },
          triggerSourceId: null,
          trigger: 'manual',
        }),
      );
    expect(retry).toMatchObject({ ok: true, value: { status: 'queued' } });
    if (!retry.ok) throw new Error('Retry was not accepted.');
    await vi.waitFor(async () => {
      await expect(
        atlas.getWorkspaceSourceTaskRun(retry.value as { taskId: string; runId: string }),
      ).resolves.toMatchObject({ result: { status: 'failed' }, status: 'completed' });
    });
    await expect(atlas.getWorkspaceProjectionSnapshot(workspaceId)).resolves.toMatchObject({
      nodes: [{ id: 'plan:product' }],
    });
  });

  it('retains failed execution history without publishing a projection', async () => {
    const atlas = createAtlasOntahiApplication([], {
      workspaceRoleFor: () => Effect.succeed('owner'),
    });
    const register = atlas.application.graph.entities.AtlasWorkspace.domain.registerSource;
    const reconcile = atlas.application.graph.entities.AtlasWorkspace.domain.reconcileSources;
    const context = {
      principal: { issuer: 'atlas', kind: 'user', subject: 'user-1' },
      resources: new Map([
        [ATLAS_GITHUB_REPOSITORY_DISCOVERY_RESOURCE, {
          installationUrl: () => Promise.resolve('https://github.test/install'),
          list: () => Promise.resolve({
            connectionRequired: false,
            installationUrl: 'https://github.test/install',
            repositories: [{ defaultRef: 'main', fullName: 'acme/product', installationId: 'installation-1', isPrivate: false }],
          }),
        }],
        [ATLAS_WORKSPACE_SOURCE_RECONCILIATION_RESOURCE, {
          reconcile: () => Promise.reject(new Error('GitHub tree unavailable')),
        }],
      ]),
    } as never;
    const registered = await withInvocationContext(context, () =>
      atlas.application.invokeOperation(register, {
        workspace: { id: workspaceId },
        repository: 'acme/product',
      }),
    );
    if (!registered.ok) throw new Error('Source fixture was not registered.');

    const accepted = await withInvocationContext(context, () =>
        atlas.application.invokeOperation(reconcile, {
          workspace: { id: workspaceId },
          triggerSourceId: (registered.value as { id: string }).id,
          trigger: 'connection',
        }),
      );
    expect(accepted).toMatchObject({ ok: true, value: { status: 'queued' } });
    if (!accepted.ok) throw new Error('Reconciliation was not accepted.');
    await vi.waitFor(async () => {
      await expect(
        atlas.getWorkspaceSourceTaskRun(accepted.value as { taskId: string; runId: string }),
      ).resolves.toMatchObject({
        result: { error: 'GitHub tree unavailable', projectionRevisionId: null, status: 'failed' },
        status: 'completed',
      });
    });
    await expect(atlas.getWorkspaceProjectionSnapshot(workspaceId)).resolves.toBeNull();
    await expect(
      atlas.application.graph.read(
        query(atlas.application.graph.entities.AtlasWorkspaceSourceImport)
          .where(sourceImport => sourceImport.workspaceId.eq(workspaceId))
          .select(sourceImport => ({ error: sourceImport.error, status: sourceImport.status })),
      ),
    ).resolves.toEqual([{ error: 'GitHub tree unavailable', status: 'failed' }]);
  });
});

describe('AtlasWorkspace.removeSource', () => {
  const discovery = {
    installationUrl: () => Promise.resolve('https://github.test/install'),
    list: () => Promise.resolve({
      connectionRequired: false,
      installationUrl: 'https://github.test/install',
      repositories: [{
        defaultRef: 'main',
        fullName: 'acme/product',
        installationId: 'installation-1',
        isPrivate: false,
      }],
    }),
  };

  it('requires owner authority and exact repository confirmation while preserving the Source', async () => {
    const atlas = createAtlasOntahiApplication([], {
      workspaceRoleFor: () => Effect.succeed('owner'),
    });
    const register = atlas.application.graph.entities.AtlasWorkspace.domain.registerSource;
    const remove = atlas.application.graph.entities.AtlasWorkspace.domain.removeSource;
    const context = {
      principal: { issuer: 'atlas', kind: 'user', subject: 'user-1' },
      resources: new Map([[ATLAS_GITHUB_REPOSITORY_DISCOVERY_RESOURCE, discovery]]),
    } as never;
    const registered = await withInvocationContext(context, () =>
      atlas.application.invokeOperation(register, {
        workspace: { id: workspaceId }, repository: 'acme/product',
      }),
    );
    if (!registered.ok) throw new Error('Source fixture was not registered.');
    const sourceId = (registered.value as { id: string }).id;

    await expect(
      withInvocationContext(context, () =>
        atlas.application.invokeOperation(remove, {
          workspace: { id: workspaceId }, source: { id: sourceId },
          confirmationRepository: 'product',
        }),
      ),
    ).resolves.toMatchObject({
      ok: false,
      failure: { reason: 'workspace_source_confirmation_mismatch' },
    });
    await expect(
      withInvocationContext(context, () =>
        atlas.application.invokeOperation(remove, {
          workspace: { id: workspaceId }, source: { id: sourceId },
          confirmationRepository: 'acme/product',
        }),
      ),
    ).resolves.toMatchObject({
      ok: true,
      value: { id: sourceId, repository: 'acme/product', status: 'paused' },
    });
    await expect(
      atlas.application.graph.read(
        query(atlas.application.graph.entities.AtlasWorkspaceSource)
          .where(source => source.id.eq(sourceId))
          .select(source => ({ repository: source.repository, status: source.status })),
      ),
    ).resolves.toEqual([{ repository: 'acme/product', status: 'paused' }]);

    await expect(
      withInvocationContext(context, () =>
        atlas.application.invokeOperation(register, {
          workspace: { id: workspaceId }, repository: 'acme/product',
        }),
      ),
    ).resolves.toMatchObject({ ok: true, value: { id: sourceId } });
    await expect(
      atlas.application.graph.read(
        query(atlas.application.graph.entities.AtlasWorkspaceSource)
          .where(source => source.id.eq(sourceId))
          .select(source => ({ status: source.status })),
      ),
    ).resolves.toEqual([{ status: 'active' }]);
  });

  it('fences an older reconciliation from publishing after desired Sources change', async () => {
    let resolveReconciliation!: (value: {
      observedAt: string;
      snapshot: { documents: never[]; edges: never[]; generatedAt: string; metrics: never[]; nodes: never[]; territories: never[] };
      sourceRevisionSetHash: string;
      sourceRevisions: never[];
    }) => void;
    const reconciliation = new Promise<Parameters<typeof resolveReconciliation>[0]>(resolve => {
      resolveReconciliation = resolve;
    });
    const reconciler = vi.fn(() => reconciliation);
    const atlas = createAtlasOntahiApplication([], {
      workspaceRoleFor: () => Effect.succeed('owner'),
    });
    const operations = atlas.application.graph.entities.AtlasWorkspace.domain;
    const context = {
      principal: { issuer: 'atlas', kind: 'user', subject: 'user-1' },
      resources: new Map<string, unknown>([
        [ATLAS_GITHUB_REPOSITORY_DISCOVERY_RESOURCE, discovery],
        [ATLAS_WORKSPACE_SOURCE_RECONCILIATION_RESOURCE, { reconcile: reconciler }],
      ]),
    } as never;
    const registered = await withInvocationContext(context, () =>
      atlas.application.invokeOperation(operations.registerSource, {
        workspace: { id: workspaceId }, repository: 'acme/product',
      }),
    );
    if (!registered.ok) throw new Error('Source fixture was not registered.');
    const sourceId = (registered.value as { id: string }).id;
    const accepted = await withInvocationContext(context, () =>
      atlas.application.invokeOperation(operations.reconcileSources, {
        workspace: { id: workspaceId }, triggerSourceId: sourceId, trigger: 'connection',
      }),
    );
    if (!accepted.ok) throw new Error('Reconciliation was not accepted.');
    await vi.waitFor(() => expect(reconciler).toHaveBeenCalledOnce());

    await withInvocationContext(context, () =>
      atlas.application.invokeOperation(operations.removeSource, {
        workspace: { id: workspaceId }, source: { id: sourceId },
        confirmationRepository: 'acme/product',
      }),
    );
    resolveReconciliation({
      observedAt: '2026-11-08T12:00:00.000Z',
      snapshot: {
        documents: [], edges: [], generatedAt: '2026-11-08T12:00:00.000Z',
        metrics: [], nodes: [], territories: [],
      },
      sourceRevisionSetHash: 'stale-revision',
      sourceRevisions: [],
    });

    await vi.waitFor(async () => {
      await expect(
        atlas.getWorkspaceSourceTaskRun(
          accepted.value as { taskId: string; runId: string },
        ),
      ).resolves.toMatchObject({
        result: {
          error: 'Workspace Source configuration changed while this import was running.',
          projectionRevisionId: null,
          status: 'failed',
        },
      });
    });
    await expect(atlas.getWorkspaceProjectionSnapshot(workspaceId)).resolves.toBeNull();
  });
});

describe('Workspace Source import read policy', () => {
  it('allows the Settings history query to order imports by start time', () => {
    expect(atlasWorkspaceSourceImportReadPolicy.fields.startedAt).toEqual({
      order: true,
      select: true,
    });
  });
});
