import { describe, expect, it, vi } from 'vitest';
import { Effect } from 'effect';
import { createInMemoryDataGraphStorage } from '@ontahi/core/data-graph';
import {
  createRuntimeProtocolDispatcher,
  createRuntimeProtocolRequest,
} from '@ontahi/core/runtime/protocol';
import {
  createOperationInvocationDispatcher,
  withInvocationContext,
} from '@ontahi/core/runtime/server';
import {
  createGraphHttpIngressOperationDispatcher,
  createGraphHttpIngressRouter,
} from '@ontahi/core/runtime/server/ingress';

import { createAtlasGitHubWebhookIngressProvider } from '../github/webhook-ingress-provider';
import { createAtlasGitHubWebhookSignature } from '../github/webhook-signature';
import type { AtlasMarkdownFile } from '../sources/markdown-source';
import { normalizeAtlasSourceRecord } from '../sources/normalized-source';
import {
  buildAtlasOntahiDataset,
  createAtlasOntahiApplication,
  createAtlasOntahiApplicationWithStorage,
} from './atlas-application';

describe('Atlas Ontahi fit pilot', () => {
  it('hydrates normalized records and preserves declared relations before viewer derivation', async () => {
    const files: AtlasMarkdownFile[] = [
      {
        path: 'plans/next/10-reader-evolution.md',
        source: 'product',
        content: `# Reader Evolution
Status: next

## Related

[Runtime Foundation](platform://plans/20-runtime-foundation)
`,
      },
      {
        path: 'plans/next/11-reader-playback.md',
        source: 'product',
        content: `# Reader Playback
Status: next
Parent plan: [Reader Evolution](product://plans/10-reader-evolution)
`,
      },
      {
        path: 'plans/done/20-runtime-foundation.md',
        source: 'platform',
        content: `# Runtime Foundation
Status: done
`,
      },
      {
        path: 'atlas/items/product.md',
        source: 'product',
        content: `---
id: product
kind: project
title: Product
status: in-progress
relatedPlans:
  - plans/next/10-reader-evolution.md
---
`,
      },
      {
        path: 'atlas/items/product/reader.md',
        source: 'product',
        content: `---
id: product.reader
kind: experience
title: Reader Experience
parent: product
status: shaping
supports:
  - platform
relatedPlans:
  - plans/next/10-reader-evolution.md
  - plans/next/11-reader-playback.md
---
`,
      },
      {
        path: 'atlas/items/product/reader/audio.md',
        source: 'product',
        content: `---
id: product.reader.audio
kind: capability
title: Reader Audio
parent: product.reader
status: idea
relatedPlans: []
---
`,
      },
      {
        path: 'atlas/items/platform.md',
        source: 'platform',
        content: `---
id: platform
kind: project
title: Platform
status: in-progress
relatedPlans:
  - plans/done/20-runtime-foundation.md
---
`,
      },
    ];
    const atlas = createAtlasOntahiApplication(files.map(normalizeAtlasSourceRecord));

    await expect(atlas.getItemContext('product.reader')).resolves.toEqual({
      id: 'atlas:product.reader',
      semanticId: 'product.reader',
      title: 'Reader Experience',
      kind: 'experience',
      status: 'shaping',
      parent: {
        id: 'atlas:product',
        semanticId: 'product',
        title: 'Product',
      },
      children: [
        {
          id: 'atlas:product.reader.audio',
          semanticId: 'product.reader.audio',
          title: 'Reader Audio',
        },
      ],
      shapingBindings: [
        {
          plan: {
            id: 'plan:product://plans/10-reader-evolution',
            path: 'product://plans/10-reader-evolution',
            title: 'Reader Evolution',
            status: 'next',
          },
        },
        {
          plan: {
            id: 'plan:product://plans/11-reader-playback',
            path: 'product://plans/11-reader-playback',
            title: 'Reader Playback',
            status: 'next',
          },
        },
      ],
    });
    await expect(atlas.getItemContext('product')).resolves.toMatchObject({
      shapingBindings: [
        {
          plan: {
            path: 'product://plans/10-reader-evolution',
          },
        },
      ],
    });
    await expect(atlas.getItemContexts()).resolves.toMatchObject({
      product: { semanticId: 'product' },
      'product.reader': { semanticId: 'product.reader' },
      'product.reader.audio': { semanticId: 'product.reader.audio' },
      platform: { semanticId: 'platform' },
    });
    await expect(atlas.getTopologyEdges()).resolves.toEqual(
      expect.arrayContaining([
        {
          id: 'root:planning->atlas:product:contains',
          from: 'root:planning',
          to: 'atlas:product',
          kind: 'contains',
        },
        {
          id: 'atlas:product->atlas:product.reader:contains',
          from: 'atlas:product',
          to: 'atlas:product.reader',
          kind: 'contains',
        },
        {
          id: 'atlas:product.reader->atlas:platform:supports',
          from: 'atlas:product.reader',
          to: 'atlas:platform',
          kind: 'supports',
        },
        {
          id: 'atlas:product.reader->plan:product://plans/10-reader-evolution:shaped-by',
          from: 'atlas:product.reader',
          to: 'plan:product://plans/10-reader-evolution',
          kind: 'shaped-by',
        },
        {
          id: 'plan:product://plans/10-reader-evolution->plan:product://plans/11-reader-playback:contains',
          from: 'plan:product://plans/10-reader-evolution',
          to: 'plan:product://plans/11-reader-playback',
          kind: 'contains',
        },
        {
          id: 'plan:product://plans/10-reader-evolution->plan:platform://plans/20-runtime-foundation:related',
          from: 'plan:product://plans/10-reader-evolution',
          to: 'plan:platform://plans/20-runtime-foundation',
          kind: 'related',
        },
      ]),
    );
    expect(await atlas.getTopologyEdges()).not.toContainEqual(
      expect.objectContaining({
        from: 'atlas:product',
        to: 'plan:product://plans/10-reader-evolution',
        kind: 'shaped-by',
      }),
    );
    expect(atlas.application.graph.entities).toMatchObject({
      AtlasItem: expect.objectContaining({ name: 'AtlasItem' }),
      AtlasPlan: expect.objectContaining({ name: 'AtlasPlan' }),
      AtlasExecutionStream: expect.objectContaining({ name: 'AtlasExecutionStream' }),
      AtlasExecutionStreamActivity: expect.objectContaining({
        name: 'AtlasExecutionStreamActivity',
      }),
      AtlasExecutionStreamRoot: expect.objectContaining({ name: 'AtlasExecutionStreamRoot' }),
      EvidenceBinding: expect.objectContaining({ name: 'EvidenceBinding' }),
      AtlasPlanRelationBinding: expect.objectContaining({ name: 'AtlasPlanRelationBinding' }),
      AtlasShapingBinding: expect.objectContaining({ name: 'AtlasShapingBinding' }),
      AtlasSupportBinding: expect.objectContaining({ name: 'AtlasSupportBinding' }),
      PullRequest: expect.objectContaining({ name: 'PullRequest' }),
    });
    const closeStream = atlas.application.graph.entities.AtlasExecutionStream.domain.close;
    const forkStream = atlas.application.graph.entities.AtlasExecutionStream.domain.fork;
    expect(closeStream.id).toBe('AtlasExecutionStream.close');
    expect(closeStream.authority).toBe('server');
    expect(closeStream.exposure).toBe('bridge');
    expect(forkStream.id).toBe('AtlasExecutionStream.fork');
    expect(forkStream.authority).toBe('server');
    expect(forkStream.exposure).toBe('bridge');
    await expect(
      withInvocationContext({ principal: null }, () =>
        atlas.application.checkPermission(closeStream, { id: 'stream-1' }),
      ),
    ).resolves.toMatchObject({ allowed: false, reason: 'not_authenticated' });
    await expect(
      withInvocationContext(
        { principal: { issuer: 'atlas', kind: 'service', subject: 'worker-1' } },
        () => atlas.application.checkPermission(closeStream, { id: 'stream-1' }),
      ),
    ).resolves.toMatchObject({ allowed: false, reason: 'not_authorized' });
    await expect(
      withInvocationContext(
        { principal: { issuer: 'atlas', kind: 'user', subject: 'user-1' } },
        () => atlas.application.checkPermission(closeStream, { id: 'stream-1' }),
      ),
    ).resolves.toEqual({ allowed: true });
  });

  it('forks selected source-tree Plans transactionally for the authenticated owner', async () => {
    const files: AtlasMarkdownFile[] = [
      {
        path: 'plans/current/124-streams.md',
        source: 'atlas',
        content: '# 124. Streams\n\nStatus: current\n',
      },
      {
        path: 'plans/current/125-routing.md',
        source: 'atlas',
        content: `# 125. Routing

Status: current

Parent plan: [Streams](124-streams.md)
`,
      },
    ];
    const userId = '5c388354-c812-469e-b99d-a074ff108263';
    const sourceStreamId = '43bd10df-f2cf-4f05-8f1d-3666f5614771';
    const timestamp = '2026-09-03T00:00:00.000Z';
    const sourceDataset = buildAtlasOntahiDataset(
      files.map(normalizeAtlasSourceRecord),
    );
    const dataset = {
      ...sourceDataset,
      AtlasUser: [
        {
          id: userId,
          name: 'Session Owner',
          email: 'session-owner@example.com',
          emailVerified: true,
          image: null,
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      ],
      AtlasExecutionStream: [
        {
          id: sourceStreamId,
          userId,
          mode: 'implicit',
          status: 'open',
          title: 'Streams',
          currentFocusPlanId: 'plan:atlas://plans/124-streams',
          forkedFromStreamId: null,
          openedAt: timestamp,
          closedAt: null,
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      ],
      AtlasExecutionStreamRoot: [
        {
          id: `execution-stream-root:${sourceStreamId}:plan:atlas://plans/124-streams`,
          streamId: sourceStreamId,
          planId: 'plan:atlas://plans/124-streams',
          addedAt: timestamp,
        },
      ],
    };
    const atlas = createAtlasOntahiApplicationWithStorage({
      storage: createInMemoryDataGraphStorage({ dataset }),
      capabilities: {
        runtime: {
          projection: { reconcile: () => Effect.die('unused') },
          proposals: { linkPlanToItem: () => Effect.die('unused') },
        },
      },
    });
    const entities = atlas.application.graph.entities;

    await expect(
      withInvocationContext(
        {
          principal: {
            issuer: 'atlas',
            kind: 'user',
            subject: '26a09541-2cc4-4f86-b02d-34b8e8e29a52',
          },
        },
        () =>
          atlas.application.invokeOperation(
            entities.AtlasExecutionStream.domain.fork,
            {
              sourceStreamId,
              title: 'Not owned',
              planIds: ['plan:atlas://plans/125-routing'],
            },
          ),
      ),
    ).resolves.toMatchObject({
      ok: false,
      failure: { reason: 'not_found' },
    });
    await expect(
      withInvocationContext(
        { principal: { issuer: 'atlas', kind: 'user', subject: userId } },
        () =>
          atlas.application.invokeOperation(
            entities.AtlasExecutionStream.domain.fork,
            { sourceStreamId, title: 'Empty fork', planIds: [] },
          ),
      ),
    ).resolves.toMatchObject({
      ok: false,
      failure: { reason: 'invalid_input' },
    });

    await expect(
      withInvocationContext(
        { principal: { issuer: 'atlas', kind: 'user', subject: userId } },
        () =>
          atlas.application.invokeOperation(
            entities.AtlasExecutionStream.domain.fork,
            {
              sourceStreamId,
              title: 'Routing',
              planIds: ['plan:atlas://plans/125-routing'],
            },
          ),
      ),
    ).resolves.toMatchObject({
      ok: true,
      value: {
        forkedFromStreamId: sourceStreamId,
        rootPlanIds: ['plan:atlas://plans/125-routing'],
        title: 'Routing',
      },
    });

    await expect(atlas.getExecutionStreams(userId)).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          mode: 'explicit',
          title: 'Routing',
          forkedFromStream: { id: sourceStreamId, title: 'Streams' },
          roots: [expect.objectContaining({ id: 'plan:atlas://plans/125-routing' })],
          activities: [],
        }),
      ]),
    );

    await withInvocationContext(
      { principal: { issuer: 'atlas', kind: 'user', subject: userId } },
      () =>
        atlas.application.invokeOperation(
          entities.AtlasExecutionStream.domain.close,
          { id: sourceStreamId },
        ),
    );
    await expect(
      withInvocationContext(
        { principal: { issuer: 'atlas', kind: 'user', subject: userId } },
        () =>
          atlas.application.invokeOperation(
            entities.AtlasExecutionStream.domain.fork,
            {
              sourceStreamId,
              title: 'Closed source',
              planIds: ['plan:atlas://plans/125-routing'],
            },
          ),
      ),
    ).resolves.toMatchObject({
      ok: false,
      failure: { reason: 'invalid_state' },
    });
  });

  it('hydrates explicit merged PR evidence for both plans and semantic items', async () => {
    const files: AtlasMarkdownFile[] = [
      {
        path: 'plans/current/102-evidence.md',
        source: 'atlas',
        content: '# Evidence\nStatus: current\n',
      },
      {
        path: 'atlas/items/evidence.md',
        source: 'atlas',
        content: `---
id: atlas.evidence
kind: evidence
title: Evidence
status: shaping
relatedPlans:
  - plans/current/102-evidence.md
---
`,
      },
    ];
    const atlas = createAtlasOntahiApplication(files.map(normalizeAtlasSourceRecord), {
      observedPullRequests: [
        {
          id: 'github:javifernandes/atlas#8',
          sourceId: 'atlas',
          repositoryFullName: 'javifernandes/atlas',
          number: 8,
          title: 'Connect merged PR evidence',
          url: 'https://github.com/javifernandes/atlas/pull/8',
          authorAvatarUrl: 'https://avatars.example/javi',
          authorProviderAccountId: '101',
          authorLogin: 'javi',
          mergedByAvatarUrl: 'https://avatars.example/maintainer',
          mergedByLogin: 'maintainer',
          mergedAt: '2026-09-01T10:00:00Z',
          mergeCommitSha: 'abc123',
          directives: [
            { kind: 'implements', target: 'plans/current/102-evidence.md' },
            { kind: 'implements', target: '102' },
            { kind: 'shapes', target: 'atlas.evidence' },
            { kind: 'shapes', target: 'missing.item' },
          ],
        },
      ],
    });

    await expect(atlas.getEvidence()).resolves.toEqual([
      expect.objectContaining({
        kind: 'shapes',
        provenance: 'explicit',
        targetNodeId: 'atlas:atlas.evidence',
        pullRequest: expect.objectContaining({
          authorAvatarUrl: 'https://avatars.example/javi',
          mergedByLogin: 'maintainer',
          repositoryFullName: 'javifernandes/atlas',
          number: 8,
        }),
      }),
      expect.objectContaining({
        kind: 'implements',
        provenance: 'explicit',
        targetNodeId: 'plan:atlas://plans/102-evidence',
        pullRequest: expect.objectContaining({
          repositoryFullName: 'javifernandes/atlas',
          number: 8,
        }),
      }),
    ]);
    expect(atlas.application.graph.listHttpIngress()).toEqual([
      expect.objectContaining({
        operationId: 'PullRequest.refreshAfterMerge',
        route: '/api/ingress/github/webhook',
        provider: 'github-webhook',
        channel: 'source-control.pull-request.merged',
      }),
      expect.objectContaining({
        operationId: 'ProjectionRevision.refreshAfterPush',
        route: '/api/ingress/github/webhook',
        provider: 'github-webhook',
        channel: 'source-control.repository.pushed',
      }),
    ]);
  });

  it('returns no context when the semantic item is missing', async () => {
    const atlas = createAtlasOntahiApplication([]);

    await expect(atlas.getItemContext('missing')).resolves.toBeNull();
  });

  it('dispatches a signed merged PR webhook through Ontahi ingress', async () => {
    const invalidateRepository = vi.fn();
    const atlas = createAtlasOntahiApplication([], { invalidateRepository });
    const secret = 'atlas-test-secret';
    const router = createGraphHttpIngressRouter({
      routes: atlas.application.graph.listHttpIngress(),
      providers: {
        'github-webhook': createAtlasGitHubWebhookIngressProvider({ getSecret: () => secret }),
      },
      dispatch: createGraphHttpIngressOperationDispatcher({
        dispatcher: createOperationInvocationDispatcher(atlas.application),
      }),
    });
    const payload = JSON.stringify({
      action: 'closed',
      installation: { id: 1234 },
      repository: { full_name: 'acme/product' },
      pull_request: {
        number: 42,
        title: 'Connect implementation evidence',
        body: 'Atlas-Shapes: product.reader',
        html_url: 'https://github.com/acme/product/pull/42',
        merged: true,
        merged_at: '2026-09-01T10:00:00Z',
        merge_commit_sha: 'abc123',
        user: { id: 101, login: 'javi' },
      },
    });
    const response = await router.handle(
      new Request('https://atlas.test/api/ingress/github/webhook', {
        method: 'POST',
        headers: {
          'x-github-delivery': 'delivery-1',
          'x-github-event': 'pull_request',
          'x-hub-signature-256': createAtlasGitHubWebhookSignature(payload, secret),
        },
        body: payload,
      }),
    );

    expect(response.status).toBe(202);
    expect(invalidateRepository).toHaveBeenCalledOnce();
    expect(invalidateRepository).toHaveBeenCalledWith('acme/product');
  });

  it('returns a reviewable Markdown proposal through the Runtime Protocol operation family', async () => {
    const files: AtlasMarkdownFile[] = [
      {
        path: 'plans/current/10-runtime.md',
        source: 'atlas',
        content: '# Runtime\nStatus: current\n',
      },
      {
        path: 'atlas/items/runtime.md',
        source: 'atlas',
        content: `---
id: runtime
kind: capability
title: Runtime
status: shaping
relatedPlans: []
---
`,
      },
    ];
    const atlas = createAtlasOntahiApplication(files.map(normalizeAtlasSourceRecord));
    const dispatch = createRuntimeProtocolDispatcher({
      handlers: {
        operation: createOperationInvocationDispatcher(atlas.application),
      },
    });
    const request = createRuntimeProtocolRequest({
      id: 'atlas-proposal-1',
      family: 'operation',
      body: {
        version: 1,
        kind: 'invoke',
        operationId: 'AtlasItem.proposePlanLink',
        input: {
          item: {
            kind: 'entity-ref',
            entityName: 'AtlasItem',
            locator: { id: 'atlas:runtime' },
          },
          plan: {
            kind: 'entity-ref',
            entityName: 'AtlasPlan',
            locator: { id: 'plan:atlas://plans/10-runtime' },
          },
        },
      },
    });

    const response = await dispatch(request, {});

    expect(response).toMatchObject({
      protocol: 'ontahi.runtime',
      version: 1,
      id: 'atlas-proposal-1',
      kind: 'response',
      family: 'operation',
      body: {
        kind: 'invocation-result',
        result: {
          ok: true,
          kind: 'success',
          value: {
            status: 'proposed',
            itemSemanticId: 'runtime',
            planPath: 'atlas://plans/10-runtime',
            planReference: 'plans/current/10-runtime.md',
            sourcePath: 'atlas/items/runtime.md',
          },
        },
      },
    });
    expect(response).not.toHaveProperty('body.result.value.before');
    expect(response).not.toHaveProperty('body.result.value.after');
    expect(files[1]?.content).toContain('relatedPlans: []');
  });
});
