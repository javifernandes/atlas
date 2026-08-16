import { describe, expect, it } from 'vitest';

import { buildPlanWorkstreamSnapshotFromFiles } from './build-snapshot';

describe('plan workstream data', () => {
  it('builds plan, related, and unmaterialized candidate relationships from markdown', () => {
    const snapshot = buildPlanWorkstreamSnapshotFromFiles([
      {
        path: 'plans/backlog/99-semantic-editorial-workflows.md',
        content: `# 99. Semantic Editorial Workflows

Status: shaping
Plan kind: initiative
Scale: large
Horizon: long-term
Area: book editing, ontology, LLM collaboration
Codename: Semantic Editorial

Related plans:

1. [GraphOS](../current/77-domain-topology-and-graphos-layers.md)
2. [GraphOS duplicate](../current/77-domain-topology-and-graphos-layers.md)

Related workstreams:

1. [Publication State](./95-content-publication-state.md) - lifecycle
2. [Publication State duplicate](./95-content-publication-state.md)

## Summary

BookOps should grow into a semantic editorial environment.

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
      markdown: expect.stringContaining('Semantic Editorial Workflows'),
      planKind: 'initiative',
      relatedCount: 2,
      status: 'shaping',
      territory: 'Semantic Editorial',
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
          path: 'atlas/items/bookops.md',
          content: `---
id: bookops
kind: project
title: BookOps
status: in-progress
horizon: now
supports: []
relatedPlans: []
---

BookOps is the product surface.
`,
        },
        {
          path: 'atlas/items/bookops/reader-experience.md',
          content: `---
id: bookops.reader-experience
kind: territory
title: Reader Experience
parent: bookops
status: in-progress
horizon: now
supports:
  - bookops
relatedPlans:
  - plans/done/80-reader-audio-and-soundscape-prototype.md
---

Reader Experience is the reading surface.
`,
        },
        {
          path: 'atlas/items/bookops/reader-experience/listening-experience.md',
          content: `---
id: bookops.reader-experience.listening
kind: experience
title: Listening Experience
parent: bookops.reader-experience
status: shaping
horizon: next
supports:
  - bookops
relatedPlans:
  - plans/done/80-reader-audio-and-soundscape-prototype.md
  - plans/next/81-listening-follow-up.md
exemplars:
  - bookops.model.book
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
  - bookops
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
          id: 'atlas:bookops.reader-experience.listening',
          kind: 'experience',
          exemplars: ['bookops.model.book'],
          markdown: expect.stringContaining('Listening Experience covers voices'),
          semanticId: 'bookops.reader-experience.listening',
          status: 'shaping',
          territory: 'BookOps',
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
          to: 'atlas:bookops',
        }),
        expect.objectContaining({
          from: 'atlas:bookops.reader-experience',
          kind: 'contains',
          to: 'atlas:bookops.reader-experience.listening',
        }),
        expect.objectContaining({
          from: 'atlas:bookops.reader-experience.listening',
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
          to: 'atlas:bookops',
        }),
      ]),
    );
    expect(snapshot.edges).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          from: 'atlas:bookops.reader-experience',
          kind: 'supports',
          to: 'atlas:bookops',
        }),
        expect.objectContaining({
          from: 'atlas:bookops.reader-experience.listening',
          kind: 'supports',
          to: 'atlas:bookops',
        }),
        expect.objectContaining({
          from: 'atlas:bookops.reader-experience',
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
          path: 'plans/next/128-ontahi-data-graph-execution-bridge.md',
          content: '# Relocated to Ontahi',
        },
        {
          path: 'plans/next/128-ontahi-data-graph-execution-bridge.md',
          source: 'ontahi',
          content: `# 128. Ontahi Data Graph Execution Bridge
Status: next
`,
        },
      ],
      [
        {
          path: 'atlas/items/ontahi.md',
          content: `---
id: ontahi
kind: capability
title: Ontahi external source
status: shaping
---
`,
        },
        {
          path: 'atlas/items/ontahi.md',
          source: 'ontahi',
          content: `---
id: ontahi
kind: project
title: Ontahi
status: in-progress
relatedPlans:
  - ontahi://plans/128-ontahi-data-graph-execution-bridge
---

The independently owned framework model.
`,
        },
      ],
    );

    expect(snapshot.nodes.filter(node => node.id === 'atlas:ontahi')).toEqual([
      expect.objectContaining({
        kind: 'project',
        markdown: expect.stringContaining('independently owned'),
        path: 'ontahi://atlas/ontahi',
        sourceFilePath: 'ontahi/atlas/items/ontahi.md',
      }),
    ]);
    expect(snapshot.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'plan:ontahi://plans/128-ontahi-data-graph-execution-bridge',
          path: 'ontahi://plans/128-ontahi-data-graph-execution-bridge',
          sourceFilePath: 'ontahi/plans/next/128-ontahi-data-graph-execution-bridge.md',
        }),
      ]),
    );
    expect(snapshot.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          from: 'atlas:ontahi',
          kind: 'shaped-by',
          to: 'plan:ontahi://plans/128-ontahi-data-graph-execution-bridge',
        }),
      ]),
    );
  });
});
