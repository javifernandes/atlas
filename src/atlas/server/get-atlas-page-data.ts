import fs from 'node:fs';
import path from 'node:path';

import {
  createAtlasOntahiApplication,
  type AtlasItemContext,
} from '../domain/atlas-application';
import { buildPlanWorkstreamSnapshotFromFiles } from '../markdown/build-snapshot';
import type { PlanWorkstreamSnapshot } from '../model/snapshot';
import {
  loadAtlasSourceFiles,
  type AtlasMarkdownFile,
} from '../sources/markdown-source';
import { normalizeAtlasSourceRecord } from '../sources/normalized-source';

export type AtlasPageData = {
  itemContexts: Record<string, AtlasItemContext | null>;
  snapshot: PlanWorkstreamSnapshot;
};

export const loadAtlasServerApplication = async () => {
  const sourceFiles = await loadAtlasSourceFiles({ repoRoot: getRepoRoot() });
  const records = sourceFiles.map(normalizeAtlasSourceRecord);

  return {
    atlas: createAtlasOntahiApplication(records),
    sourceFiles,
  };
};

const getRepoRoot = () => {
  const cwd = process.cwd();

  if (
    fs.existsSync(path.join(cwd, 'package.json')) ||
    fs.existsSync(path.join(cwd, 'atlas.sources.local.yaml'))
  ) {
    return cwd;
  }

  return path.resolve(cwd, '..');
};

const emptyPageData = (): AtlasPageData => ({
  itemContexts: {},
  snapshot: buildPlanWorkstreamSnapshotFromFiles([]),
});

export const getAtlasPageData = async (): Promise<AtlasPageData> => {
  let loaded: {
    atlas: ReturnType<typeof createAtlasOntahiApplication>;
    sourceFiles: AtlasMarkdownFile[];
  };

  try {
    loaded = await loadAtlasServerApplication();
  } catch (error) {
    process.stderr.write(
      `Failed to load Atlas sources: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    return emptyPageData();
  }

  const { atlas, sourceFiles } = loaded;

  return {
    itemContexts: await atlas.getItemContexts(),
    snapshot: buildPlanWorkstreamSnapshotFromFiles(
      sourceFiles.filter(file => file.path.startsWith('plans/')),
      sourceFiles.filter(file => file.path.startsWith('atlas/items/')),
    ),
  };
};
