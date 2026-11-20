import { describe, expect, it } from 'vitest';

import { normalizeAtlasSourceRecord } from '../sources/normalized-source';
import { parseAtlasSourceRecords } from './build-snapshot';
import {
  assembleParsedAtlasSourceRecordArtifacts,
  ATLAS_PARSED_RECORD_MATERIALIZER_VERSION,
  parseAtlasSourceRecordArtifact,
} from './parsed-record-artifact';

const sourceRecords = () =>
  [
    {
      path: 'plans/next/74a-unit-of-work-runtime-scope.md',
      source: 'bookops',
      sourceRevision: 'git:bookops-1',
      sourceRevisionKind: 'git' as const,
      content: `# 74a. Unit-of-Work Runtime Scope

Relocated to Ontahi.

- Canonical ID: \`ontahi://plans/74a-unit-of-work-runtime-scope\`
`,
    },
    {
      path: 'plans/done/74a-unit-of-work-runtime-scope.md',
      source: 'ontahi',
      sourceRevision: 'git:ontahi-1',
      sourceRevisionKind: 'git' as const,
      content: `# 74a. Unit-of-Work Runtime Scope

Status: done

## Summary

Define the canonical runtime scope.
`,
    },
    {
      path: 'atlas/items/runtime.md',
      source: 'atlas',
      sourceRevision: 'git:atlas-1',
      sourceRevisionKind: 'git' as const,
      content: `---
id: atlas.runtime
kind: capability
title: Runtime
status: shaping
relatedPlans:
  - bookops://plans/74a-unit-of-work-runtime-scope
---
`,
    },
    {
      path: 'README.md',
      source: 'atlas',
      content: '# Atlas',
    },
  ].map(normalizeAtlasSourceRecord);

describe('parsed Source Record artifacts', () => {
  it('assembles per-record artifacts into the same parsed source as the global parser', () => {
    const records = sourceRecords();
    const artifacts = records.map(parseAtlasSourceRecordArtifact);

    expect(assembleParsedAtlasSourceRecordArtifacts({ artifacts, records })).toEqual(
      parseAtlasSourceRecords(records),
    );
  });

  it('identifies an artifact by Source Record, content, and Materializer version', () => {
    const record = sourceRecords()[2]!;
    const artifact = parseAtlasSourceRecordArtifact(record);
    const changed = parseAtlasSourceRecordArtifact({
      ...record,
      content: `${record.content}\n## Summary\n\nChanged.\n`,
    });
    const observedAtNextRevision = { ...record, sourceRevision: 'git:atlas-2' };
    const reused = parseAtlasSourceRecordArtifact(observedAtNextRevision);

    expect(artifact).toMatchObject({
      materializerId: 'atlas.markdown-record',
      materializerVersion: ATLAS_PARSED_RECORD_MATERIALIZER_VERSION,
      sourceRecordIdentity: 'atlas://atlas/runtime',
      sourcePath: 'atlas/items/runtime.md',
    });
    expect(artifact.artifactId).not.toBe(changed.artifactId);
    expect(artifact.contentHash).not.toBe(changed.contentHash);
    expect(reused.artifactId).toBe(artifact.artifactId);
    expect(
      assembleParsedAtlasSourceRecordArtifacts({
        artifacts: [artifact],
        records: [observedAtNextRevision],
      }).items[0]?.sourceRevision,
    ).toBe('git:atlas-2');
  });
});
