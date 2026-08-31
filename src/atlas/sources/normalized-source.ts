import path from 'node:path';

import type { AtlasMarkdownFile } from './markdown-source';

export type NormalizedAtlasSourceRecord = {
  canonicalPath: string;
  content: string;
  sourceFilePath?: string;
  sourceId?: string;
  sourcePath: string;
};

const explicitReferencePattern = /^[a-z][a-z0-9+.-]*:\/\//i;

const normalizeSourcePath = (value: string) =>
  path.posix.normalize(value.replaceAll('\\', '/')).replace(/^\.\//, '').replace(/^\//, '');

const getCanonicalPath = (sourceId: string | undefined, sourcePath: string) => {
  if (!sourceId) {
    return sourcePath;
  }

  if (sourcePath.startsWith('plans/')) {
    return `${sourceId}://plans/${path.posix.basename(sourcePath, '.md')}`;
  }

  if (sourcePath.startsWith('atlas/items/')) {
    return `${sourceId}://atlas/${sourcePath.slice('atlas/items/'.length, -'.md'.length)}`;
  }

  return `${sourceId}://${sourcePath}`;
};

export const normalizeAtlasSourceRecord = (
  file: AtlasMarkdownFile,
): NormalizedAtlasSourceRecord => {
  const sourcePath = normalizeSourcePath(file.path);

  return {
    canonicalPath: getCanonicalPath(file.source, sourcePath),
    content: file.content,
    sourceFilePath: file.source ? `${file.source}/${sourcePath}` : undefined,
    sourceId: file.source,
    sourcePath,
  };
};

type ResolvePlanReferenceOptions = {
  relativeTo?: 'record' | 'source';
};

export const resolveAtlasPlanReference = (
  record: NormalizedAtlasSourceRecord,
  reference: string,
  { relativeTo = 'source' }: ResolvePlanReferenceOptions = {},
) => {
  const cleanReference = reference.split('#')[0]?.trim();

  if (!cleanReference) {
    return undefined;
  }

  if (explicitReferencePattern.test(cleanReference)) {
    return cleanReference;
  }

  if (!cleanReference.endsWith('.md')) {
    return undefined;
  }

  const sourcePath = normalizeSourcePath(
    relativeTo === 'record' && !cleanReference.startsWith('/')
      ? path.posix.join(path.posix.dirname(record.sourcePath), cleanReference)
      : cleanReference,
  );

  return getCanonicalPath(record.sourceId, sourcePath);
};
