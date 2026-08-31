import { describe, expect, it } from 'vitest';

import { buildPlanWorkstreamSnapshotFromFiles } from '../markdown/build-snapshot';
import { createAtlasOntahiApplication } from './atlas-application';

describe('Atlas Ontahi fit pilot', () => {
  it('hydrates a federated snapshot and queries item context through declared relations', async () => {
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
          path: 'atlas/items/product.md',
          source: 'product',
          content: `---
id: product
kind: project
title: Product
status: in-progress
relatedPlans: []
---
`,
        },
        {
          path: 'atlas/items/product/reader.md',
          source: 'product',
          content: `---
id: product.reader
kind: experience
title: Reader Experience
parent: product
status: shaping
relatedPlans:
  - plans/next/10-reader-evolution.md
---
`,
        },
        {
          path: 'atlas/items/product/reader/audio.md',
          source: 'product',
          content: `---
id: product.reader.audio
kind: capability
title: Reader Audio
parent: product.reader
status: idea
relatedPlans: []
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
  - plans/done/20-runtime-foundation.md
---
`,
        },
      ],
    );
    const atlas = createAtlasOntahiApplication(snapshot);

    await expect(atlas.getItemContext('product.reader')).resolves.toEqual({
      id: 'atlas:product.reader',
      semanticId: 'product.reader',
      title: 'Reader Experience',
      kind: 'experience',
      status: 'shaping',
      parent: {
        id: 'atlas:product',
        semanticId: 'product',
        title: 'Product',
      },
      children: [
        {
          id: 'atlas:product.reader.audio',
          semanticId: 'product.reader.audio',
          title: 'Reader Audio',
        },
      ],
      shapingBindings: [
        {
          plan: {
            id: 'plan:product://plans/10-reader-evolution',
            path: 'product://plans/10-reader-evolution',
            title: 'Reader Evolution',
            status: 'next',
          },
        },
      ],
    });
    expect(atlas.application.graph.entities).toMatchObject({
      AtlasItem: expect.objectContaining({ name: 'AtlasItem' }),
      AtlasPlan: expect.objectContaining({ name: 'AtlasPlan' }),
      AtlasShapingBinding: expect.objectContaining({ name: 'AtlasShapingBinding' }),
    });
  });

  it('returns no context when the semantic item is missing', async () => {
    const atlas = createAtlasOntahiApplication({
      generatedAt: '2026-08-31T00:00:00.000Z',
      metrics: [],
      territories: [],
      nodes: [],
      edges: [],
    });

    await expect(atlas.getItemContext('missing')).resolves.toBeNull();
  });
});
