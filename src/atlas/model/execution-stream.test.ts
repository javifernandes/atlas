import { describe, expect, it } from 'vitest';

import {
  buildAtlasSessionInstructions,
  parseAtlasSessionDirective,
  resolveExecutionStreamActivityTarget,
  resolveExecutionStreamForkPlans,
  resolveExecutionStreamPlanContext,
} from './execution-stream';

const plans = [
  { id: 'plan:runtime', parentPlanId: null, title: 'Runtime Protocol' },
  { id: 'plan:runtime-child', parentPlanId: 'plan:runtime', title: 'Fetch Runtime' },
  { id: 'plan:relations', parentPlanId: null, title: 'Relations' },
  { id: 'plan:relations-child', parentPlanId: 'plan:relations', title: 'Constraints' },
];

describe('resolveExecutionStreamPlanContext', () => {
  it('keeps one primary focus and includes the roots of every referenced plan', () => {
    expect(
      resolveExecutionStreamPlanContext({
        bindings: [
          {
            kind: 'shapes',
            planId: 'plan:relations-child',
            pullRequestId: 'pr:125',
          },
          {
            kind: 'implements',
            planId: 'plan:runtime-child',
            pullRequestId: 'pr:125',
          },
        ],
        plans,
        pullRequestId: 'pr:125',
      }),
    ).toEqual({
      focusPlan: plans[1],
      rootPlans: [plans[0], plans[2]],
    });
  });

  it('deduplicates a shared root and ignores unrelated or unresolved bindings', () => {
    expect(
      resolveExecutionStreamPlanContext({
        bindings: [
          {
            kind: 'implements',
            planId: 'plan:runtime-child',
            pullRequestId: 'pr:125',
          },
          {
            kind: 'implements',
            planId: 'plan:runtime',
            pullRequestId: 'pr:125',
          },
          { kind: 'implements', planId: 'plan:missing', pullRequestId: 'pr:125' },
          { kind: 'implements', planId: 'plan:relations', pullRequestId: 'pr:other' },
        ],
        plans,
        pullRequestId: 'pr:125',
      }),
    ).toEqual({
      focusPlan: plans[1],
      rootPlans: [plans[0]],
    });
  });

  it('returns no context when the pull request has no resolved plan binding', () => {
    expect(
      resolveExecutionStreamPlanContext({
        bindings: [
          { kind: 'implements', planId: 'plan:missing', pullRequestId: 'pr:125' },
        ],
        plans,
        pullRequestId: 'pr:125',
      }),
    ).toBeNull();
  });
});

describe('parseAtlasSessionDirective', () => {
  it('distinguishes an absent directive from a valid canonical Session id', () => {
    expect(parseAtlasSessionDirective('Atlas-Implements: atlas://plans/124-streams')).toEqual({
      kind: 'absent',
    });
    expect(
      parseAtlasSessionDirective(`Atlas-Implements: atlas://plans/124-streams

  atlas-session: 43BD10DF-F2CF-4F05-8F1D-3666F5614771  `),
    ).toEqual({
      kind: 'valid',
      sessionId: '43bd10df-f2cf-4f05-8f1d-3666f5614771',
    });
  });

  it('fails closed for malformed and duplicate Session directives', () => {
    expect(parseAtlasSessionDirective('Atlas-Session: not-a-uuid')).toEqual({
      kind: 'invalid',
      reason: 'malformed',
    });
    expect(
      parseAtlasSessionDirective(`Atlas-Session: 43bd10df-f2cf-4f05-8f1d-3666f5614771
Atlas-Session: 8dc3c55f-903e-4f68-8561-b27710b07aa5`),
    ).toEqual({
      kind: 'invalid',
      reason: 'duplicate',
    });
    expect(parseAtlasSessionDirective('Atlas-Session 43bd10df-f2cf-4f05-8f1d-3666f5614771')).toEqual({
      kind: 'invalid',
      reason: 'malformed',
    });
  });
});

describe('buildAtlasSessionInstructions', () => {
  it('produces a portable chat instruction with the exact PR directive', () => {
    expect(
      buildAtlasSessionInstructions({
        id: '43bd10df-f2cf-4f05-8f1d-3666f5614771',
        title: 'Atlas Sessions',
        url: 'https://atlas.example/?view=sessions&session=43bd10df-f2cf-4f05-8f1d-3666f5614771',
      }),
    ).toBe(`Atlas Session: Atlas Sessions
Session ID: 43bd10df-f2cf-4f05-8f1d-3666f5614771
Session URL: https://atlas.example/?view=sessions&session=43bd10df-f2cf-4f05-8f1d-3666f5614771

For every PR created for this work, keep this line in the PR body:
Atlas-Session: 43bd10df-f2cf-4f05-8f1d-3666f5614771`);
  });
});

describe('resolveExecutionStreamForkPlans', () => {
  it('keeps the exact selected Plans as ordered, deduplicated fork roots', () => {
    expect(
      resolveExecutionStreamForkPlans({
        plans,
        selectedPlanIds: [
          'plan:runtime-child',
          'plan:relations',
          'plan:runtime-child',
        ],
        sourceRootPlanIds: ['plan:runtime', 'plan:relations'],
      }),
    ).toEqual([plans[1], plans[2]]);
  });

  it('rejects an empty selection or a Plan outside the source Session tree', () => {
    expect(
      resolveExecutionStreamForkPlans({
        plans,
        selectedPlanIds: [],
        sourceRootPlanIds: ['plan:runtime'],
      }),
    ).toBeNull();
    expect(
      resolveExecutionStreamForkPlans({
        plans,
        selectedPlanIds: ['plan:relations-child'],
        sourceRootPlanIds: ['plan:runtime'],
      }),
    ).toBeNull();
  });
});

describe('resolveExecutionStreamActivityTarget', () => {
  const implicit = {
    id: '43bd10df-f2cf-4f05-8f1d-3666f5614771',
    mode: 'implicit' as const,
    status: 'open' as const,
    userId: 'user-1',
  };
  const explicit = {
    id: '8dc3c55f-903e-4f68-8561-b27710b07aa5',
    mode: 'explicit' as const,
    status: 'open' as const,
    userId: 'user-1',
  };

  it('preserves implicit compatibility when no Session is declared', () => {
    expect(
      resolveExecutionStreamActivityTarget({
        directive: { kind: 'absent' },
        streams: [implicit, explicit],
        userId: 'user-1',
      }),
    ).toEqual({
      attribution: 'implicit-single-open',
      kind: 'existing',
      stream: implicit,
    });
    expect(
      resolveExecutionStreamActivityTarget({
        directive: { kind: 'absent' },
        streams: [explicit],
        userId: 'user-1',
      }),
    ).toEqual({ kind: 'create-implicit' });
  });

  it('routes a valid directive exactly and never falls back when it cannot be honored', () => {
    expect(
      resolveExecutionStreamActivityTarget({
        directive: { kind: 'valid', sessionId: explicit.id },
        streams: [implicit, explicit],
        userId: 'user-1',
      }),
    ).toEqual({
      attribution: 'explicit-directive',
      kind: 'existing',
      stream: explicit,
    });

    const invalidTargets: Array<
      Array<{
        id: string;
        mode: 'explicit' | 'implicit';
        status: 'closed' | 'open';
        userId: string;
      }>
    > = [
      [implicit],
      [implicit, { ...explicit, status: 'closed' as const }],
      [implicit, { ...explicit, userId: 'user-2' }],
    ];

    for (const streams of invalidTargets) {
      expect(
        resolveExecutionStreamActivityTarget({
          directive: { kind: 'valid', sessionId: explicit.id },
          streams,
          userId: 'user-1',
        }),
      ).toEqual({ kind: 'unrouted' });
    }

    expect(
      resolveExecutionStreamActivityTarget({
        directive: { kind: 'invalid', reason: 'malformed' },
        streams: [implicit, explicit],
        userId: 'user-1',
      }),
    ).toEqual({ kind: 'unrouted' });
  });
});
