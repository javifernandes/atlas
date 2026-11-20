import { describe, expect, it } from 'vitest';

import type { InteractionItemModel } from '../model/item-kind';
import { buildInteractionLensProjection } from './interaction-lens';

const model: InteractionItemModel = {
  actors: [],
  affordances: [{ affordanceKind: 'invokes', atStep: 'Decide', label: 'Accept' }],
  context: [],
  goal: 'Respond',
  kind: 'interaction',
  outcomes: [{ fromStep: 'Decide', meaning: 'Joined', outcome: 'Accepted' }],
  presents: [{ atStep: 'Inspect', information: 'Workspace', source: 'Invitation' }],
  scope: { binding: 'invitation', entity: 'Invitation' },
  steps: [
    { label: 'Inspect', next: ['Known', 'GitHub', 'Email'], stepKind: 'presents' },
    { label: 'Known', next: ['Decide'], stepKind: 'context' },
    { label: 'GitHub', next: ['Decide'], stepKind: 'context' },
    { label: 'Email', next: ['Decide'], stepKind: 'context' },
    { label: 'Decide', next: [], stepKind: 'branch' },
  ],
};

describe('Interaction lens projection', () => {
  it('groups contextual branches into one moment and attaches semantic detail', () => {
    const projection = buildInteractionLensProjection(model);

    expect(projection.moments.map(moment => moment.steps.map(step => step.label))).toEqual([
      ['Inspect'],
      ['Known', 'GitHub', 'Email'],
      ['Decide'],
    ]);
    expect(projection.moments[0]?.steps[0]?.presents).toHaveLength(1);
    expect(projection.moments[2]?.steps[0]?.affordances).toHaveLength(1);
    expect(projection.moments[2]?.steps[0]?.outcomes).toHaveLength(1);
  });
});
