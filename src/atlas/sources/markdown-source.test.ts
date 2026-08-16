import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { loadExternalAtlasSourceFiles, parseAtlasSources } from './markdown-source';

const temporaryDirectories: string[] = [];

const createTemporaryDirectory = () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'bookops-atlas-source-'));
  temporaryDirectories.push(directory);
  return directory;
};

const writeSourceRegistry = (repoRoot: string, localRoot: string) => {
  fs.writeFileSync(
    path.join(repoRoot, 'atlas.sources.yaml'),
    `version: 1
sources:
  bookops:
    repository: https://github.com/javifernandes/bookops
    localRoot: .
    ref: main
  ontahi:
    repository: https://github.com/javifernandes/ontahi
    localRoot: ${localRoot}
    ref: main
`,
  );
};

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe('Atlas source loader', () => {
  it('parses named source repositories, local roots, and refs', () => {
    expect(
      parseAtlasSources(`version: 1
sources:
  ontahi:
    repository: https://github.com/javifernandes/ontahi
    localRoot: ../ontahi
    ref: main
`),
    ).toEqual([
      {
        id: 'ontahi',
        repository: 'https://github.com/javifernandes/ontahi',
        localRoot: '../ontahi',
        ref: 'main',
      },
    ]);
  });

  it('prefers a sibling checkout over GitHub', async () => {
    const repoRoot = createTemporaryDirectory();
    const sourceRoot = createTemporaryDirectory();
    writeSourceRegistry(repoRoot, sourceRoot);
    fs.mkdirSync(path.join(sourceRoot, 'atlas', 'items'), { recursive: true });
    fs.mkdirSync(path.join(sourceRoot, 'plans', 'next'), { recursive: true });
    fs.writeFileSync(path.join(sourceRoot, 'atlas', 'items', 'ontahi.md'), '# Ontahi');
    fs.writeFileSync(path.join(sourceRoot, 'plans', 'next', '128-bridge.md'), '# Bridge');
    const fetcher = vi.fn();

    await expect(
      loadExternalAtlasSourceFiles({ currentSource: 'bookops', fetcher, repoRoot }),
    ).resolves.toEqual([
      { path: 'plans/next/128-bridge.md', content: '# Bridge', source: 'ontahi' },
      { path: 'atlas/items/ontahi.md', content: '# Ontahi', source: 'ontahi' },
    ]);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('loads public GitHub Markdown when the sibling checkout is unavailable', async () => {
    const repoRoot = createTemporaryDirectory();
    writeSourceRegistry(repoRoot, '../missing-ontahi');
    const fetcher = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);

      if (url.includes('/git/trees/')) {
        return Response.json({
          tree: [
            { path: 'atlas/items/ontahi.md', type: 'blob' },
            { path: 'plans/next/128-bridge.md', type: 'blob' },
            { path: 'packages/core/package.json', type: 'blob' },
          ],
        });
      }

      return new Response(url.includes('atlas/items') ? '# Ontahi' : '# Bridge');
    }) as typeof fetch;

    await expect(
      loadExternalAtlasSourceFiles({ currentSource: 'bookops', fetcher, repoRoot }),
    ).resolves.toEqual([
      { path: 'atlas/items/ontahi.md', content: '# Ontahi', source: 'ontahi' },
      { path: 'plans/next/128-bridge.md', content: '# Bridge', source: 'ontahi' },
    ]);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
});
