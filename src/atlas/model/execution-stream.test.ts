import { describe, expect, it } from 'vitest';

import { resolveExecutionStreamPlanContext } from './execution-stream';

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
