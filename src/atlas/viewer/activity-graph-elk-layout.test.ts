import { describe, expect, it } from 'vitest';

import type { ActivityGraph } from '../model/activity-graph';
import { buildActivityGraphElkLayout } from './activity-graph-elk-layout';
import { buildActivityGraphLensProjection } from './activity-graph-lens';

describe('ELK Activity Graph layout', () => {
  it('lays out a cyclic interaction and returns routed edges without changing semantics', async () => {
    const graph: ActivityGraph = {
      actors: [],
      entry: 'checkpoint',
      nodes: [
        { id: 'checkpoint', kind: 'decision', label: 'Authenticated?', reads: [], presents: [] },
        { id: 'authenticate', kind: 'activity', label: 'Sign in', reads: [], presents: [] },
        { id: 'continue', kind: 'decision', label: 'Continue', reads: [], presents: [] },
      ],
      transitions: [
        { id: 'sign-in', affordance: 'Sign in', branch: 'No', from: 'checkpoint', to: 'authenticate' },
        { id: 'retry', from: 'authenticate', result: 'Authentication changed', to: 'checkpoint' },
        { id: 'continue', from: 'checkpoint', to: 'continue' },
      ],
    };

    const layout = await buildActivityGraphElkLayout(
      buildActivityGraphLensProjection(graph),
    );

    expect(layout.nodes.map(node => node.id).sort()).toEqual([
      'authenticate',
      'checkpoint',
      'continue',
    ]);
    expect(layout.edges).toHaveLength(graph.transitions.length);
    expect(layout.edges.every(edge => edge.path.startsWith('M '))).toBe(true);
    expect(layout.edges.find(edge => edge.id === 'sign-in')).toMatchObject({
      labelX: expect.any(Number),
      labelY: expect.any(Number),
    });
    expect(layout.width).toBeGreaterThan(0);
    expect(layout.height).toBeGreaterThan(0);
    expect(graph.nodes[0]).not.toHaveProperty('x');
  });

  it('projects the same graph horizontally or vertically', async () => {
    const graph: ActivityGraph = {
      actors: [],
      entry: 'start',
      nodes: [
        { id: 'start', kind: 'stimulus', label: 'Start', reads: [], presents: [] },
        { id: 'finish', kind: 'outcome', label: 'Finish', reads: [], presents: [] },
      ],
      transitions: [
        { id: 'continue', from: 'start', to: 'finish' },
      ],
    };
    const projection = buildActivityGraphLensProjection(graph);

    const horizontal = await buildActivityGraphElkLayout(projection, 'horizontal');
    const vertical = await buildActivityGraphElkLayout(projection, 'vertical');
    const horizontalNodes = new Map(horizontal.nodes.map(node => [node.id, node]));
    const verticalNodes = new Map(vertical.nodes.map(node => [node.id, node]));

    expect(horizontalNodes.get('finish')!.x).toBeGreaterThan(horizontalNodes.get('start')!.x);
    expect(verticalNodes.get('finish')!.y).toBeGreaterThan(verticalNodes.get('start')!.y);
  });

  it('centers vertical parents over the span of their forked children', async () => {
    const graph: ActivityGraph = {
      actors: [],
      entry: 'start',
      nodes: [
        { id: 'start', kind: 'stimulus', label: 'Start', reads: [], presents: [] },
        { id: 'fork', kind: 'decision', label: 'Choose a path', reads: [], presents: [] },
        { id: 'cancel', kind: 'outcome', label: 'Cancelled', reads: [], presents: [] },
        { id: 'email', kind: 'activity', label: 'Enter email', reads: [], presents: [] },
        { id: 'github', kind: 'activity', label: 'Choose GitHub identity', reads: [], presents: [] },
        { id: 'user', kind: 'activity', label: 'Choose Atlas User', reads: [], presents: [] },
        { id: 'merge', kind: 'merge', label: 'Recipient addressed', reads: [], presents: [] },
        { id: 'eligible', kind: 'decision', label: 'Can this recipient be invited?', reads: [], presents: [] },
        { id: 'existing', kind: 'outcome', label: 'Existing access', reads: [], presents: [] },
        { id: 'invalid', kind: 'outcome', label: 'Cannot be addressed', reads: [], presents: [] },
        { id: 'access', kind: 'activity', label: 'Choose access', reads: [], presents: [] },
        { id: 'create', kind: 'operation', label: 'Create invitation', reads: [], presents: [] },
        { id: 'created', kind: 'outcome', label: 'Invitation created', reads: [], presents: [] },
        { id: 'refused', kind: 'outcome', label: 'Invitation refused', reads: [], presents: [] },
      ],
      transitions: [
        { id: 'begin', from: 'start', result: 'Invitation flow started', to: 'fork' },
        { id: 'cancel', branch: 'Cancel', from: 'fork', to: 'cancel' },
        { id: 'email', branch: 'Email', from: 'fork', to: 'email' },
        { id: 'github', branch: 'GitHub', from: 'fork', to: 'github' },
        { id: 'user', branch: 'User', from: 'fork', to: 'user' },
        { id: 'merge-email', from: 'email', to: 'merge' },
        { id: 'merge-github', from: 'github', to: 'merge' },
        { id: 'merge-user', from: 'user', to: 'merge' },
        { id: 'validate', from: 'merge', to: 'eligible' },
        { id: 'existing', branch: 'Existing access', from: 'eligible', to: 'existing' },
        { id: 'invalid', branch: 'Cannot address', from: 'eligible', to: 'invalid' },
        { id: 'eligible', branch: 'Eligible', from: 'eligible', to: 'access' },
        { id: 'create', from: 'access', to: 'create' },
        { id: 'created', from: 'create', to: 'created' },
        { id: 'refused', from: 'create', to: 'refused' },
      ],
    };

    const layout = await buildActivityGraphElkLayout(
      buildActivityGraphLensProjection(graph),
      'vertical',
    );
    const nodes = new Map(layout.nodes.map(node => [node.id, node]));
    const centerX = (id: string) => {
      const node = nodes.get(id)!;
      return node.x + node.width / 2;
    };
    const childCenters = ['cancel', 'email', 'github', 'user'].map(centerX);
    const childrenMidpoint = (
      Math.min(...childCenters) + Math.max(...childCenters)
    ) / 2;

    expect(Math.abs(centerX('fork') - childrenMidpoint)).toBeLessThan(5);
    expect(Math.abs(centerX('start') - centerX('fork'))).toBeLessThan(5);
    expect(layout.edges.find(edge => edge.id === 'begin')).toMatchObject({
      labelX: expect.any(Number),
      labelY: expect.any(Number),
    });
    expect(layout.edges.find(edge => edge.id === 'begin')?.path).not.toContain(' Q ');

    const eligibilityChildren = ['existing', 'invalid', 'access'].map(centerX);
    const eligibilityMidpoint = (
      Math.min(...eligibilityChildren) + Math.max(...eligibilityChildren)
    ) / 2;
    expect(Math.abs(centerX('eligible') - eligibilityMidpoint)).toBeLessThan(5);
  });
});
