import { describe, expect, it } from 'vitest';

import { auditAtlasPrContext } from './check-atlas-pr-context.mjs';

const itemPath = 'atlas/items/spec-workstream-atlas/example.md';
const planPath = 'plans/current/999-example.md';

describe('Atlas PR context audit', () => {
  it('requires every changed durable target when implementation changes beside it', () => {
    expect(
      auditAtlasPrContext({
        body: 'Atlas-Implements: plans/current/999-example.md',
        changedFiles: ['src/example.ts', itemPath, planPath],
        itemIdsByPath: { [itemPath]: 'spec-workstream-atlas.example' },
      }),
    ).toEqual([
      `${itemPath} changes durable Atlas Item spec-workstream-atlas.example, but the PR body does not reference it under Atlas-Implements or Atlas-Shapes.`,
    ]);
  });

  it('accepts list directives and canonical plan URIs', () => {
    expect(
      auditAtlasPrContext({
        body: `Atlas-Implements:\n- atlas://plans/999-example\n\nAtlas-Shapes:\n- spec-workstream-atlas.example`,
        changedFiles: ['migrations/999-example.sql', itemPath, planPath],
        itemIdsByPath: { [itemPath]: 'spec-workstream-atlas.example' },
      }),
    ).toEqual([]);
  });

  it('does not force evidence metadata for documentation-only changes', () => {
    expect(
      auditAtlasPrContext({
        body: '',
        changedFiles: [itemPath, planPath],
        itemIdsByPath: { [itemPath]: 'spec-workstream-atlas.example' },
      }),
    ).toEqual([]);
  });
});
