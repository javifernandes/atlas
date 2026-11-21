import { createHash } from 'node:crypto';

import {
  isAtlasItemMarkdownPath,
  isAtlasPackageManifestPath,
} from '../sources/markdown-source';
import type { NormalizedAtlasSourceRecord } from '../sources/normalized-source';
import {
  parseAtlasItem,
  parsePlan,
  type ParsedAtlasItem,
  type ParsedAtlasSource,
  type ParsedPlan,
} from './build-snapshot';

export const ATLAS_PARSED_RECORD_MATERIALIZER_ID = 'atlas.markdown-record';
export const ATLAS_PARSED_RECORD_MATERIALIZER_VERSION = '1';

export type ParsedAtlasSourceRecordArtifact = {
  artifactId: string;
  contentHash: string;
  item: ParsedAtlasItem | null;
  materializerId: typeof ATLAS_PARSED_RECORD_MATERIALIZER_ID;
  materializerVersion: typeof ATLAS_PARSED_RECORD_MATERIALIZER_VERSION;
  plan: ParsedPlan | null;
  relocationTarget?: string;
  sourceRecordIdentity: string;
  sourcePath: string;
};

const getRelocationTarget = (record: NormalizedAtlasSourceRecord) => {
  if (
    !record.sourcePath.startsWith('plans/') ||
    !/^Relocated to\s+.+\.?$/im.test(record.content)
  ) {
    return undefined;
  }

  const canonicalId = record.content.match(
    /^\s*-\s*Canonical ID:\s*(?:`([^`]+)`|([^\s]+))\s*$/im,
  );

  return canonicalId?.[1]?.trim() ?? canonicalId?.[2]?.trim();
};

export const atlasParsedRecordContentHash = (content: string) =>
  createHash('sha256').update(content).digest('hex');

const isPlanRecord = (record: NormalizedAtlasSourceRecord) =>
  record.sourcePath.startsWith('plans/') &&
  record.sourcePath !== 'plans/README.md' &&
  record.sourcePath !== 'plans/done/README.md' &&
  record.sourcePath !== 'plans/research/README.md';

export const parseAtlasSourceRecordArtifact = (
  record: NormalizedAtlasSourceRecord,
): ParsedAtlasSourceRecordArtifact => {
  const contentHash = atlasParsedRecordContentHash(record.content);
  const relocationTarget = getRelocationTarget(record);
  const sourceRecordIdentity = record.canonicalPath;
  const derivationRecord = {
    ...record,
    sourceRevision: undefined,
    sourceRevisionKind: undefined,
  };

  return {
    artifactId: `${sourceRecordIdentity}@sha256:${contentHash}#${ATLAS_PARSED_RECORD_MATERIALIZER_VERSION}`,
    contentHash,
    item:
      isAtlasItemMarkdownPath(record.sourcePath) ||
      isAtlasPackageManifestPath(record.sourcePath)
        ? parseAtlasItem(derivationRecord)
        : null,
    materializerId: ATLAS_PARSED_RECORD_MATERIALIZER_ID,
    materializerVersion: ATLAS_PARSED_RECORD_MATERIALIZER_VERSION,
    plan: isPlanRecord(record) && !relocationTarget ? parsePlan(derivationRecord) : null,
    ...(relocationTarget ? { relocationTarget } : {}),
    sourceRecordIdentity,
    sourcePath: record.sourcePath,
  };
};

export type PortableParsedAtlasSourceRecordArtifact = {
  artifactId: string;
  contentHash: string;
  materializerId: typeof ATLAS_PARSED_RECORD_MATERIALIZER_ID;
  materializerVersion: typeof ATLAS_PARSED_RECORD_MATERIALIZER_VERSION;
  payloadJson: string;
  sourceRecordIdentity: string;
  sourcePath: string;
};

export const serializeParsedAtlasSourceRecordArtifact = (
  artifact: ParsedAtlasSourceRecordArtifact,
): PortableParsedAtlasSourceRecordArtifact => ({
  artifactId: artifact.artifactId,
  contentHash: artifact.contentHash,
  materializerId: artifact.materializerId,
  materializerVersion: artifact.materializerVersion,
  payloadJson: JSON.stringify({
    item: artifact.item,
    plan: artifact.plan,
    relocationTarget: artifact.relocationTarget ?? null,
  }),
  sourceRecordIdentity: artifact.sourceRecordIdentity,
  sourcePath: artifact.sourcePath,
});

export const deserializeParsedAtlasSourceRecordArtifact = (
  artifact: PortableParsedAtlasSourceRecordArtifact,
): ParsedAtlasSourceRecordArtifact => {
  const payload = JSON.parse(artifact.payloadJson) as {
    item: ParsedAtlasItem | null;
    plan: ParsedPlan | null;
    relocationTarget: string | null;
  };

  return {
    artifactId: artifact.artifactId,
    contentHash: artifact.contentHash,
    item: payload.item,
    materializerId: artifact.materializerId,
    materializerVersion: artifact.materializerVersion,
    plan: payload.plan,
    ...(payload.relocationTarget ? { relocationTarget: payload.relocationTarget } : {}),
    sourceRecordIdentity: artifact.sourceRecordIdentity,
    sourcePath: artifact.sourcePath,
  };
};

const resolveRelocationAlias = (reference: string, aliases: Map<string, string>) => {
  let resolvedReference = reference;
  const visited = new Set<string>();

  while (!visited.has(resolvedReference)) {
    visited.add(resolvedReference);
    const target = aliases.get(resolvedReference);

    if (!target) {
      break;
    }

    resolvedReference = target;
  }

  return resolvedReference;
};

export const assembleParsedAtlasSourceRecordArtifacts = (input: {
  artifacts: readonly ParsedAtlasSourceRecordArtifact[];
  records: readonly NormalizedAtlasSourceRecord[];
}): ParsedAtlasSource => {
  const { artifacts, records } = input;
  const recordsByIdentity = new Map(records.map(record => [record.canonicalPath, record]));
  const currentLineage = (artifact: ParsedAtlasSourceRecordArtifact) => {
    const record = recordsByIdentity.get(artifact.sourceRecordIdentity);

    return {
      sourceRevision: record?.sourceRevision,
      sourceRevisionKind: record?.sourceRevisionKind,
    };
  };
  const relocationAliases = new Map(
    artifacts.flatMap(artifact =>
      artifact.relocationTarget
        ? ([[artifact.sourceRecordIdentity, artifact.relocationTarget]] as const)
        : [],
    ),
  );
  const resolveAlias = (reference: string) =>
    resolveRelocationAlias(reference, relocationAliases);
  const plans = artifacts.flatMap(artifact =>
    artifact.plan
      ? [
          {
            ...artifact.plan,
            ...currentLineage(artifact),
            relatedLinks: artifact.plan.relatedLinks.map(link => ({
              ...link,
              path: resolveAlias(link.path),
            })),
            parentPlanPath: artifact.plan.parentPlanPath
              ? resolveAlias(artifact.plan.parentPlanPath)
              : undefined,
          },
        ]
      : [],
  );
  const items = [
    ...new Map(
      artifacts
        .flatMap(artifact =>
          artifact.item ? [{ ...artifact.item, ...currentLineage(artifact) }] : [],
        )
        .map(item => ({
          ...item,
          relatedPlans: [...new Set(item.relatedPlans.map(resolveAlias))],
        }))
        .map(item => [item.id, item] as const),
    ).values(),
  ];

  return { items, plans };
};
