import { describe, expect, it } from 'vitest';

import type { AtlasMarkdownFile } from '../sources/markdown-source';
import { normalizeAtlasSourceRecord } from '../sources/normalized-source';
import { parseAtlasSourceRecords } from '../markdown/build-snapshot';
import { proposePlanLink } from './plan-link-proposal';

const source = (files: AtlasMarkdownFile[]) =>
  parseAtlasSourceRecords(files.map(normalizeAtlasSourceRecord));

describe('proposePlanLink', () => {
  it('adds a source-local Plan reference to an empty relatedPlans list', () => {
    const proposal = proposePlanLink(
      source([
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

Runtime boundary.
`,
        },
      ]),
      { itemSemanticId: 'runtime', planPath: 'atlas://plans/10-runtime' },
    );

    expect(proposal).toMatchObject({
      status: 'proposed',
      sourceId: 'atlas',
      sourcePath: 'atlas/items/runtime.md',
      planReference: 'plans/current/10-runtime.md',
    });
    expect(proposal.after).toContain(`relatedPlans:
  - plans/current/10-runtime.md`);
    expect(proposal.patch).toContain('+++ b/atlas/items/runtime.md');
    expect(proposal.patch).toContain('+  - plans/current/10-runtime.md');
  });

  it('uses the canonical Plan path across sources and leaves an existing link unchanged', () => {
    const parsed = source([
      {
        path: 'plans/current/10-runtime.md',
        source: 'ontahi',
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
relatedPlans:
  - ontahi://plans/10-runtime
---
`,
      },
    ]);

    expect(
      proposePlanLink(parsed, {
        itemSemanticId: 'runtime',
        planPath: 'ontahi://plans/10-runtime',
      }),
    ).toMatchObject({
      status: 'already-linked',
      patch: '',
      planReference: 'ontahi://plans/10-runtime',
    });
  });

  it('creates the relatedPlans field when the item does not declare one', () => {
    const proposal = proposePlanLink(
      source([
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
---

Runtime boundary.
`,
        },
      ]),
      { itemSemanticId: 'runtime', planPath: 'atlas://plans/10-runtime' },
    );

    expect(proposal.after).toContain(`status: shaping
relatedPlans:
  - plans/current/10-runtime.md
---`);
  });
});
