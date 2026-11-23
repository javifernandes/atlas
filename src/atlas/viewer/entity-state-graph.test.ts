import { describe, expect, it } from 'vitest';

import { buildEntityStateGraph, buildEntityStateGraphLayout } from './entity-state-graph';

describe('Entity state graph', () => {
  it('keeps operation references on successful transition edges', () => {
    const graph = buildEntityStateGraph({
      fields: [],
      invariants: [],
      operations: [{
        actor: 'Workspace Owner',
        appliesWhen: 'Before creation',
        effects: 'Records the offer',
        name: 'Invite',
        reference: './invite.md',
        transition: 'none -> Pending',
      }],
      relations: [],
      states: [{ kind: 'initial', meaning: 'Awaiting response', name: 'Pending' }],
    });

    expect(graph.nodes.map(node => node.id)).toEqual(['state:$start', 'state:Pending']);
    expect(graph.edges).toContainEqual(expect.objectContaining({
      from: 'state:$start',
      label: 'Invite',
      operationReference: './invite.md',
      to: 'state:Pending',
    }));
  });

  it('centers the lifecycle trunk and keeps terminal branches compact', async () => {
    const graph = buildEntityStateGraph({
      fields: [],
      invariants: [],
      operations: [
        { actor: 'Owner', appliesWhen: '', effects: '', name: 'Invite', transition: 'none -> Pending' },
        { actor: 'Recipient', appliesWhen: '', effects: '', name: 'Claim', transition: 'Pending -> Claimed' },
        { actor: 'Recipient', appliesWhen: '', effects: '', name: 'Accept', transition: 'Claimed -> Accepted' },
        { actor: 'Recipient', appliesWhen: '', effects: '', name: 'Decline', transition: 'Claimed -> Declined' },
        { actor: 'Owner', appliesWhen: '', effects: '', name: 'Revoke', transition: 'Pending -> Revoked' },
        { actor: 'Owner', appliesWhen: '', effects: '', name: 'Revoke', transition: 'Claimed -> Revoked' },
        { actor: 'System', appliesWhen: '', effects: '', name: 'Expire', transition: 'Pending -> Expired' },
        { actor: 'System', appliesWhen: '', effects: '', name: 'Expire', transition: 'Claimed -> Expired' },
      ],
      relations: [],
      states: [
        { kind: 'initial', meaning: '', name: 'Pending' },
        { kind: 'active', meaning: '', name: 'Claimed' },
        { kind: 'terminal', meaning: '', name: 'Accepted' },
        { kind: 'terminal', meaning: '', name: 'Declined' },
        { kind: 'terminal', meaning: '', name: 'Revoked' },
        { kind: 'terminal', meaning: '', name: 'Expired' },
      ],
    });

    const layout = await buildEntityStateGraphLayout(graph);
    const byLabel = new Map(layout.nodes.map(node => [node.label, node]));
    const center = (label: string) => {
      const node = byLabel.get(label);
      if (!node) throw new Error(`Missing ${label}`);
      return node.x + node.width / 2;
    };

    expect(Math.abs(center('Start') - center('Pending'))).toBeLessThan(2);
    expect(Math.abs(center('Pending') - center('Claimed'))).toBeLessThan(2);
    expect(layout.width).toBeLessThan(1000);

    const edgeStarts = (from: string) => layout.edges
      .filter(edge => edge.from === `state:${from}`)
      .map(edge => edge.path.match(/^M ([\d.]+) ([\d.]+)/)?.slice(1).join(','));

    expect(new Set(edgeStarts('Pending')).size).toBe(1);
    expect(new Set(edgeStarts('Claimed')).size).toBe(1);

    const edgeEnds = (to: string) => layout.edges
      .filter(edge => edge.to === `state:${to}`)
      .map(edge => edge.path.match(/L ([\d.]+) ([\d.]+)$/)?.slice(1).join(','));

    expect(new Set(edgeEnds('Revoked')).size).toBe(2);
    expect(new Set(edgeEnds('Expired')).size).toBe(2);

    const incomingTerminalEdges = layout.edges.filter(edge =>
      ['state:Revoked', 'state:Expired'].includes(edge.to),
    );
    for (const edge of incomingTerminalEdges) {
      const coordinates = [...edge.path.matchAll(/[ML] ([\d.]+) ([\d.]+)/g)]
        .map(match => ({ x: Number(match[1]), y: Number(match[2]) }));
      const entryBend = coordinates.at(-2);
      const target = coordinates.at(-1);
      expect(entryBend).toBeDefined();
      expect(target).toBeDefined();
      expect(Math.abs((target?.y ?? 0) - (entryBend?.y ?? 0))).toBeGreaterThanOrEqual(24);
    }

    const pending = byLabel.get('Pending');
    const pendingFork = layout.edges.find(edge => edge.id === 'fork-trunk:state:Pending');
    if (!pending || !pendingFork) throw new Error('Missing Pending fork');
    const forkEndY = Number(pendingFork.path.match(/L [\d.]+ ([\d.]+)$/)?.[1]);
    expect(forkEndY - (pending.y + pending.height)).toBeGreaterThanOrEqual(20);
  });
});
