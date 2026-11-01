import { describe, expect, it, vi } from 'vitest';
import { withInvocationContext, type ModelProvider } from '@ontahi/core/runtime/server';

import { normalizeAtlasSourceRecord } from '../sources/normalized-source';
import { createAtlasOntahiApplication } from './atlas-application';

describe('AtlasWorkspace.askPlans', () => {
  it('supplies bounded Plan context and accepts citations from it', async () => {
    const generate = vi.fn(async request => {
      const context = JSON.parse(request.context) as { plans: Array<{ id: string; path: string }> };
      const cited = context.plans[0]!;
      return {
        answer: 'Workspace ownership is the authorization boundary.',
        citations: [
          { planId: cited.id, path: cited.path, title: 'Workspace Ownership' },
        ],
      };
    });
    const provider: ModelProvider = { generate };
    const atlas = createAtlasOntahiApplication(
      [
        normalizeAtlasSourceRecord({
          path: 'plans/current/137-workspace.md',
          content: '# Workspace Ownership\n\nStatus: current\n\nWorkspace membership authorizes access.',
        }),
      ],
      { assistantProvider: provider },
    );
    const operation = atlas.application.graph.entities.AtlasWorkspace.domain.askPlans;

    const result = await withInvocationContext(
      {
        principal: { issuer: 'atlas', kind: 'user', subject: 'user-1' },
      } as never,
      () =>
        atlas.application.invokeOperation(operation, {
          workspace: { id: '00000000-0000-4000-8000-000000000137' },
          question: 'What authorizes workspace access?',
        }),
    );

    expect(result, JSON.stringify(result)).toMatchObject({
      ok: true,
      value: { answer: 'Workspace ownership is the authorization boundary.' },
    });
    expect(generate).toHaveBeenCalledOnce();
  });

  it('rejects callers without an authorized Workspace principal', async () => {
    const generate = vi.fn();
    const atlas = createAtlasOntahiApplication([], {
      assistantProvider: { generate } as ModelProvider,
    });
    const operation = atlas.application.graph.entities.AtlasWorkspace.domain.askPlans;

    await expect(
      atlas.application.invokeOperation(operation, {
        workspace: { id: '00000000-0000-4000-8000-000000000137' },
        question: 'What authorizes workspace access?',
      }),
    ).resolves.toMatchObject({
      ok: false,
      failure: { reason: 'assistant_unauthorized' },
    });
    expect(generate).not.toHaveBeenCalled();
  });

  it('reports an unavailable assistant when no model provider is configured', async () => {
    const atlas = createAtlasOntahiApplication([]);
    const operation = atlas.application.graph.entities.AtlasWorkspace.domain.askPlans;

    await expect(
      withInvocationContext(
        { principal: { issuer: 'atlas', kind: 'user', subject: 'user-1' } } as never,
        () =>
          atlas.application.invokeOperation(operation, {
            workspace: { id: '00000000-0000-4000-8000-000000000137' },
            question: 'What authorizes workspace access?',
          }),
      ),
    ).resolves.toMatchObject({
      ok: false,
      failure: { reason: 'assistant_unavailable' },
    });
  });

  it('rejects citations outside the bounded Plan context', async () => {
    const provider: ModelProvider = {
      generate: vi.fn(async () => ({
        answer: 'An unrelated Plan answers this.',
        citations: [{
          planId: 'plan:atlas://plans/not-supplied',
          path: 'atlas://plans/not-supplied',
          title: 'Not supplied',
        }],
      })),
    };
    const atlas = createAtlasOntahiApplication(
      [
        normalizeAtlasSourceRecord({
          path: 'plans/current/137-workspace.md',
          content: '# Workspace Ownership\n\nStatus: current\n\nWorkspace membership authorizes access.',
        }),
      ],
      { assistantProvider: provider },
    );
    const operation = atlas.application.graph.entities.AtlasWorkspace.domain.askPlans;

    await expect(
      withInvocationContext(
        { principal: { issuer: 'atlas', kind: 'user', subject: 'user-1' } } as never,
        () =>
          atlas.application.invokeOperation(operation, {
            workspace: { id: '00000000-0000-4000-8000-000000000137' },
            question: 'What authorizes workspace access?',
          }),
      ),
    ).resolves.toMatchObject({
      ok: false,
      failure: { reason: 'assistant_invalid_citations' },
    });
  });
});
