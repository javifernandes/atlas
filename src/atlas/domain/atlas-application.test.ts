import { describe, expect, it } from 'vitest';
import {
  createRuntimeProtocolDispatcher,
  createRuntimeProtocolRequest,
} from '@ontahi/core/runtime/protocol';
import { createOperationInvocationDispatcher } from '@ontahi/core/runtime/server';

import type { AtlasMarkdownFile } from '../sources/markdown-source';
import { normalizeAtlasSourceRecord } from '../sources/normalized-source';
import { createAtlasOntahiApplication } from './atlas-application';

describe('Atlas Ontahi fit pilot', () => {
  it('hydrates normalized records and preserves declared relations before viewer derivation', async () => {
    const files: AtlasMarkdownFile[] = [
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
      {
        path: 'atlas/items/product.md',
        source: 'product',
        content: `---
id: product
kind: project
title: Product
status: in-progress
relatedPlans:
  - plans/next/10-reader-evolution.md
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
    ];
    const atlas = createAtlasOntahiApplication(files.map(normalizeAtlasSourceRecord));

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
    await expect(atlas.getItemContext('product')).resolves.toMatchObject({
      shapingBindings: [
        {
          plan: {
            path: 'product://plans/10-reader-evolution',
          },
        },
      ],
    });
    await expect(atlas.getItemContexts()).resolves.toMatchObject({
      product: { semanticId: 'product' },
      'product.reader': { semanticId: 'product.reader' },
      'product.reader.audio': { semanticId: 'product.reader.audio' },
      platform: { semanticId: 'platform' },
    });
    expect(atlas.application.graph.entities).toMatchObject({
      AtlasItem: expect.objectContaining({ name: 'AtlasItem' }),
      AtlasPlan: expect.objectContaining({ name: 'AtlasPlan' }),
      AtlasShapingBinding: expect.objectContaining({ name: 'AtlasShapingBinding' }),
    });
  });

  it('returns no context when the semantic item is missing', async () => {
    const atlas = createAtlasOntahiApplication([]);

    await expect(atlas.getItemContext('missing')).resolves.toBeNull();
  });

  it('returns a reviewable Markdown proposal through the Runtime Protocol operation family', async () => {
    const files: AtlasMarkdownFile[] = [
      {
        path: 'plans/current/10-runtime.md',
        source: 'atlas',
        content: '# Runtime\nStatus: current\n',
      },
      {
        path: 'atlas/items/runtime.md',
        source: 'atlas',
        content: `---
id: runtime
kind: capability
title: Runtime
status: shaping
relatedPlans: []
---
`,
      },
    ];
    const atlas = createAtlasOntahiApplication(files.map(normalizeAtlasSourceRecord));
    const dispatch = createRuntimeProtocolDispatcher({
      handlers: {
        operation: createOperationInvocationDispatcher(atlas.application),
      },
    });
    const request = createRuntimeProtocolRequest({
      id: 'atlas-proposal-1',
      family: 'operation',
      body: {
        version: 1,
        kind: 'invoke',
        operationId: 'AtlasItem.proposePlanLink',
        input: {
          item: {
            kind: 'entity-ref',
            entityName: 'AtlasItem',
            locator: { id: 'atlas:runtime' },
          },
          plan: {
            kind: 'entity-ref',
            entityName: 'AtlasPlan',
            locator: { id: 'plan:atlas://plans/10-runtime' },
          },
        },
      },
    });

    const response = await dispatch(request, {});

    expect(response).toMatchObject({
      protocol: 'ontahi.runtime',
      version: 1,
      id: 'atlas-proposal-1',
      kind: 'response',
      family: 'operation',
      body: {
        kind: 'invocation-result',
        result: {
          ok: true,
          kind: 'success',
          value: {
            status: 'proposed',
            itemSemanticId: 'runtime',
            planPath: 'atlas://plans/10-runtime',
            planReference: 'plans/current/10-runtime.md',
            sourcePath: 'atlas/items/runtime.md',
          },
        },
      },
    });
    expect(response).not.toHaveProperty('body.result.value.before');
    expect(response).not.toHaveProperty('body.result.value.after');
    expect(files[1]?.content).toContain('relatedPlans: []');
  });
});
