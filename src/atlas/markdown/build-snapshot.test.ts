import { describe, expect, it } from 'vitest';

import { buildPlanWorkstreamSnapshotFromFiles } from './build-snapshot';

describe('plan workstream data', () => {
  it('builds plan, related, and unmaterialized candidate relationships from markdown', () => {
    const snapshot = buildPlanWorkstreamSnapshotFromFiles([
      {
        path: 'plans/backlog/99-semantic-editorial-workflows.md',
        content: `# 99. Product Strategy Workflows

Status: shaping
Plan kind: initiative
Scale: large
Horizon: long-term
Area: book editing, ontology, LLM collaboration
Codename: Product Strategy
Territory: Product Strategy
Workstream: Strategy

Related plans:

1. [GraphOS](../current/77-domain-topology-and-graphos-layers.md)
2. [GraphOS duplicate](../current/77-domain-topology-and-graphos-layers.md)

Related workstreams:

1. [Publication State](./95-content-publication-state.md) - lifecycle
2. [Publication State duplicate](./95-content-publication-state.md)

## Summary

Product should grow into a semantic editorial environment.

## Plan Hierarchy Experiment

Candidate child plans:

1. Editorial domain operation contracts for books.
2. Planning metadata and nested plan methodology.
`,
      },
      {
        path: 'plans/backlog/95-content-publication-state.md',
        content: `# 95. Content Publication State
Status: backlog

## Summary

Publication status for content.
`,
      },
      {
        path: 'plans/current/77-domain-topology-and-graphos-layers.md',
        content: `# 77. Domain Topology And GraphOS Layers
Status: active design plan

## Summary

GraphOS topology work.
`,
      },
      {
        path: 'plans/next/108-atlas-item-type-model.md',
        content: `# 108. Atlas Item Type Model
Status: shaping

## Summary

Define the broader item type model.

## Child Plans

1. [107. Plan Model Research And v0](./107-plan-model-research-and-v0.md)
`,
      },
      {
        path: 'plans/next/107-plan-model-research-and-v0.md',
        content: `# 107. Plan Model Research And v0
Status: next

Parent plan: [108. Atlas Item Type Model](./108-atlas-item-type-model.md)

## Summary

Define Plan as the first pilot.
`,
      },
    ]);

    const plan99 = snapshot.nodes.find(
      node => node.id === 'plan:plans/backlog/99-semantic-editorial-workflows.md',
    );

    expect(plan99).toMatchObject({
      candidateCount: 2,
      markdown: expect.stringContaining('Product Strategy Workflows'),
      planKind: 'initiative',
      relatedCount: 2,
      status: 'shaping',
      territory: 'Product Strategy',
    });
    expect(
      snapshot.edges.filter(
        edge =>
          edge.from === 'plan:plans/backlog/99-semantic-editorial-workflows.md' &&
          edge.kind === 'related' &&
          edge.to === 'plan:plans/current/77-domain-topology-and-graphos-layers.md',
      ),
    ).toHaveLength(1);
    expect(
      snapshot.edges.filter(
        edge =>
          edge.from === 'plan:plans/backlog/99-semantic-editorial-workflows.md' &&
          edge.kind === 'related' &&
          edge.to === 'plan:plans/backlog/95-content-publication-state.md',
      ),
    ).toHaveLength(1);
    expect(snapshot.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          from: 'plan:plans/backlog/99-semantic-editorial-workflows.md',
          kind: 'related',
          to: 'plan:plans/backlog/95-content-publication-state.md',
        }),
        expect.objectContaining({
          from: 'plan:plans/backlog/99-semantic-editorial-workflows.md',
          kind: 'candidate',
        }),
        expect.objectContaining({
          from: 'plan:plans/backlog/99-semantic-editorial-workflows.md',
          kind: 'related',
          to: 'plan:plans/current/77-domain-topology-and-graphos-layers.md',
        }),
        expect.objectContaining({
          from: 'plan:plans/next/108-atlas-item-type-model.md',
          kind: 'contains',
          to: 'plan:plans/next/107-plan-model-research-and-v0.md',
        }),
      ]),
    );
    expect(snapshot.edges).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          from: 'plan:plans/next/107-plan-model-research-and-v0.md',
          kind: 'related',
          to: 'plan:plans/next/108-atlas-item-type-model.md',
        }),
        expect.objectContaining({
          from: 'plan:plans/next/108-atlas-item-type-model.md',
          kind: 'related',
          to: 'plan:plans/next/107-plan-model-research-and-v0.md',
        }),
      ]),
    );
  });

  it('uses atlas items as the semantic graph when atlas files are present', () => {
    const snapshot = buildPlanWorkstreamSnapshotFromFiles(
      [
        {
          path: 'plans/next/101-workstream-atlas-semantic-source.md',
          content: `# 101. Workstream Atlas Semantic Source
Status: shaping

## Summary

Build a semantic source for the atlas.
`,
        },
        {
          path: 'plans/done/80-reader-audio-and-soundscape-prototype.md',
          content: `# Reader Audio and Soundscape Prototype
Status: done

## Summary

Prototype listening inside the reader.

## Closure / Evolution

Follow-up work:

1. [Listening follow-up](../next/81-listening-follow-up.md)
`,
        },
        {
          path: 'plans/next/81-listening-follow-up.md',
          content: `# Listening follow-up
Status: next

## Summary

Continue the reader audio work.
`,
        },
        {
          path: 'plans/backlog/unlinked-plan.md',
          content: `# Unlinked Plan
Status: backlog
`,
        },
      ],
      [
        {
          path: 'atlas/items/product.md',
          content: `---
id: product
kind: project
title: Product
status: in-progress
horizon: now
supports: []
relatedPlans: []
---

Product is the product surface.
`,
        },
        {
          path: 'atlas/items/product/reader-experience.md',
          content: `---
id: product.reader-experience
kind: territory
title: Reader Experience
parent: product
status: in-progress
horizon: now
supports:
  - product
relatedPlans:
  - plans/done/80-reader-audio-and-soundscape-prototype.md
---

Reader Experience is the reading surface.
`,
        },
        {
          path: 'atlas/items/product/reader-experience/listening-experience.md',
          content: `---
id: product.reader-experience.listening
kind: experience
title: Listening Experience
parent: product.reader-experience
status: shaping
horizon: next
supports:
  - product
relatedPlans:
  - plans/done/80-reader-audio-and-soundscape-prototype.md
  - plans/next/81-listening-follow-up.md
exemplars:
  - product.model.book
---

Listening Experience covers voices and ambience.
`,
        },
        {
          path: 'atlas/items/spec-workstream-atlas.md',
          content: `---
id: spec-workstream-atlas
kind: project
title: Workstream Atlas
status: shaping
horizon: now
supports:
  - product
relatedPlans:
  - plans/next/101-workstream-atlas-semantic-source.md
---

The Workstream Atlas is the planning map.
`,
        },
        {
          path: 'atlas/items/spec-workstream-atlas/operating-principles/development-as-shape-transformation.md',
          content: `---
id: spec-workstream-atlas.operating-principles.development-as-shape-transformation
kind: principle
title: Development As Shape Transformation
status: shaping
horizon: now
supports:
  - spec-workstream-atlas
relatedPlans: []
---

Development as shape transformation frames development as changes to system form.
`,
        },
      ],
    );

    expect(snapshot.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'atlas:product.reader-experience.listening',
          kind: 'experience',
          exemplars: ['product.model.book'],
          markdown: expect.stringContaining('Listening Experience covers voices'),
          semanticId: 'product.reader-experience.listening',
          status: 'shaping',
          territory: 'Product',
        }),
        expect.objectContaining({
          id: 'plan:plans/done/80-reader-audio-and-soundscape-prototype.md',
          kind: 'plan',
          markdown: expect.stringContaining('Prototype listening inside the reader'),
        }),
        expect.objectContaining({
          id: 'atlas:spec-workstream-atlas.operating-principles.development-as-shape-transformation',
          kind: 'principle',
          title: 'Development As Shape Transformation',
        }),
      ]),
    );
    expect(snapshot.nodes).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'plan:plans/backlog/unlinked-plan.md',
        }),
      ]),
    );
    expect(snapshot.documents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'plan:plans/backlog/unlinked-plan.md',
          markdown: expect.stringContaining('Unlinked Plan'),
          path: 'plans/backlog/unlinked-plan.md',
        }),
      ]),
    );
    expect(snapshot.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          from: 'root:planning',
          kind: 'contains',
          to: 'atlas:product',
        }),
        expect.objectContaining({
          from: 'atlas:product.reader-experience',
          kind: 'contains',
          to: 'atlas:product.reader-experience.listening',
        }),
        expect.objectContaining({
          from: 'atlas:product.reader-experience.listening',
          kind: 'shaped-by',
          to: 'plan:plans/done/80-reader-audio-and-soundscape-prototype.md',
        }),
        expect.objectContaining({
          from: 'plan:plans/done/80-reader-audio-and-soundscape-prototype.md',
          kind: 'follow-up',
          to: 'plan:plans/next/81-listening-follow-up.md',
        }),
        expect.objectContaining({
          from: 'atlas:spec-workstream-atlas',
          kind: 'supports',
          to: 'atlas:product',
        }),
      ]),
    );
    expect(snapshot.edges).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          from: 'atlas:product.reader-experience',
          kind: 'supports',
          to: 'atlas:product',
        }),
        expect.objectContaining({
          from: 'atlas:product.reader-experience.listening',
          kind: 'supports',
          to: 'atlas:product',
        }),
        expect.objectContaining({
          from: 'atlas:product.reader-experience',
          kind: 'shaped-by',
          to: 'plan:plans/done/80-reader-audio-and-soundscape-prototype.md',
        }),
      ]),
    );
    expect(snapshot.metrics).toEqual(
      expect.arrayContaining([
        { label: 'items', value: '5' },
        { label: 'linked plans', value: '3' },
      ]),
    );
  });

  it('federates source-owned items and plans without duplicating a local source stub', () => {
    const snapshot = buildPlanWorkstreamSnapshotFromFiles(
      [
        {
          path: 'plans/next/128-platform-data-graph-execution-bridge.md',
          content: '# Relocated to Platform',
        },
        {
          path: 'plans/next/128-platform-data-graph-execution-bridge.md',
          source: 'platform',
          content: `# 128. Platform Data Graph Execution Bridge
Status: next
`,
        },
      ],
      [
        {
          path: 'atlas/items/platform.md',
          content: `---
id: platform
kind: capability
title: Platform external source
status: shaping
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
  - platform://plans/128-platform-data-graph-execution-bridge
---

The independently owned framework model.
`,
        },
      ],
    );

    expect(snapshot.nodes.filter(node => node.id === 'atlas:platform')).toEqual([
      expect.objectContaining({
        kind: 'project',
        markdown: expect.stringContaining('independently owned'),
        path: 'platform://atlas/platform',
        sourceFilePath: 'platform/atlas/items/platform.md',
      }),
    ]);
    expect(snapshot.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'plan:platform://plans/128-platform-data-graph-execution-bridge',
          path: 'platform://plans/128-platform-data-graph-execution-bridge',
          sourceFilePath: 'platform/plans/next/128-platform-data-graph-execution-bridge.md',
        }),
      ]),
    );
    expect(snapshot.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          from: 'atlas:platform',
          kind: 'shaped-by',
          to: 'plan:platform://plans/128-platform-data-graph-execution-bridge',
        }),
      ]),
    );
  });

  it('canonicalizes local plan references within their source and preserves cross-source URIs', () => {
    const snapshot = buildPlanWorkstreamSnapshotFromFiles(
      [
        {
          path: 'plans/next/10-reader-evolution.md',
          source: 'product',
          content: `# Reader Evolution
Status: next
`,
        },
        {
          path: 'plans/done/20-runtime-foundation.md',
          source: 'platform',
          content: `# Runtime Foundation
Status: done
`,
        },
      ],
      [
        {
          path: 'atlas/items/product/reader.md',
          source: 'product',
          content: `---
id: product.reader
kind: experience
title: Reader Experience
status: shaping
relatedPlans:
  - plans/next/10-reader-evolution.md
  - platform://plans/20-runtime-foundation
---
`,
        },
      ],
    );

    expect(snapshot.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          from: 'atlas:product.reader',
          kind: 'shaped-by',
          to: 'plan:product://plans/10-reader-evolution',
        }),
        expect.objectContaining({
          from: 'atlas:product.reader',
          kind: 'shaped-by',
          to: 'plan:platform://plans/20-runtime-foundation',
        }),
      ]),
    );
  });
});
