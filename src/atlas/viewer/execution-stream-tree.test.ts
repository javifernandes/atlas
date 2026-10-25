import { describe, expect, it } from 'vitest';

import type { AtlasExecutionStreamProjection } from '../model/execution-stream';
import type {
  PlanWorkstreamNode,
  PlanWorkstreamSnapshot,
} from '../model/snapshot';

import { buildExecutionTreeRows, planSourceLabel } from './execution-stream-tree';

const plan = (
  id: string,
  shortTitle: string,
  statusGroup: PlanWorkstreamNode['statusGroup'] = 'current',
): PlanWorkstreamNode => ({
  id,
  kind: 'plan',
  title: shortTitle,
  shortTitle,
  statusGroup,
  status: statusGroup,
  territory: 'Atlas',
  path: `atlas://plans/${id}`,
  sections: [],
  relatedCount: 0,
  candidateCount: 0,
});

const root = plan('136-adoption', 'Adoption');
const doneParent = plan('120-old-slice', 'Old slice', 'done');
const activeChild = plan('136a-active-slice', 'Active slice', 'next');
const sibling = plan('136b-sibling', 'Sibling', 'backlog');

const snapshot: PlanWorkstreamSnapshot = {
  generatedAt: '2026-10-25T00:00:00.000Z',
  metrics: [],
  territories: [],
  nodes: [root, doneParent, activeChild, sibling],
  edges: [
    { id: 'root-done', from: root.id, to: doneParent.id, kind: 'contains' },
    { id: 'done-active', from: doneParent.id, to: activeChild.id, kind: 'contains' },
    { id: 'root-sibling', from: root.id, to: sibling.id, kind: 'contains' },
  ],
};

const stream: AtlasExecutionStreamProjection = {
  id: '43bd10df-f2cf-4f05-8f1d-3666f5614771',
  activities: [],
  archivedAt: null,
  closedAt: null,
  currentFocusPlan: {
    id: activeChild.id,
    path: activeChild.path!,
    status: activeChild.status,
    title: activeChild.title,
  },
  forkedFromStream: null,
  mode: 'implicit',
  lastActivityAt: null,
  openedAt: '2026-10-25T00:00:00.000Z',
  roots: [
    {
      id: root.id,
      path: root.path!,
      status: root.status,
      title: root.title,
    },
  ],
  status: 'open',
  title: root.title,
  updatedAt: '2026-10-25T00:00:00.000Z',
};

describe('execution stream tree projection', () => {
  it('keeps deterministic title order and descendants of a touched Plan', () => {
    const rows = buildExecutionTreeRows(stream, snapshot, {
      collapsedNodeIds: new Set(),
      hideDone: false,
    });

    expect(rows.map(row => [row.node.shortTitle, row.depth, row.hasChildren])).toEqual([
      ['Adoption', 0, true],
      ['Old slice', 1, true],
      ['Active slice', 2, false],
      ['Sibling', 1, false],
    ]);
  });

  it('promotes active descendants when done Plans are hidden', () => {
    const rows = buildExecutionTreeRows(stream, snapshot, {
      collapsedNodeIds: new Set(),
      hideDone: true,
    });

    expect(rows.map(row => [row.node.shortTitle, row.depth])).toEqual([
      ['Adoption', 0],
      ['Active slice', 1],
      ['Sibling', 1],
    ]);
  });

  it('omits descendants of collapsed branches', () => {
    const rows = buildExecutionTreeRows(stream, snapshot, {
      collapsedNodeIds: new Set([root.id]),
      hideDone: false,
    });

    expect(rows.map(row => row.node.id)).toEqual([root.id]);
  });

  it('derives a compact source and Plan label from canonical paths', () => {
    expect(planSourceLabel(plan('136-adoption', 'Adoption'))).toBe('atlas · plan 136');
    expect(planSourceLabel({ ...root, path: 'product://plans/discovery' })).toBe('product');
  });
});
