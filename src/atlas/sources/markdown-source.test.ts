import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { loadAtlasSourceFiles, parseAtlasSources } from './markdown-source';

const temporaryDirectories: string[] = [];
const originalSourcesYaml = process.env.ATLAS_SOURCES_YAML;

const createTemporaryDirectory = () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-source-'));
  temporaryDirectories.push(directory);
  return directory;
};

const writeSourceRegistry = (repoRoot: string, localRoot: string) => {
  fs.writeFileSync(
    path.join(repoRoot, 'atlas.sources.local.yaml'),
    `version: 1
sources:
  product:
    repository: https://github.com/acme/product
    localRoot: ${localRoot}
    ref: main
`,
  );
};

afterEach(() => {
  if (originalSourcesYaml === undefined) {
    delete process.env.ATLAS_SOURCES_YAML;
  } else {
    process.env.ATLAS_SOURCES_YAML = originalSourcesYaml;
  }

  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe('Atlas source loader', () => {
  it('parses named source repositories, local roots, and refs', () => {
    expect(
      parseAtlasSources(`version: 1
sources:
  platform:
    repository: https://github.com/acme/platform
    localRoot: ../platform
    ref: stable
`),
    ).toEqual([
      {
        id: 'platform',
        repository: 'https://github.com/acme/platform',
        localRoot: '../platform',
        ref: 'stable',
      },
    ]);
  });

  it('prefers a sibling checkout over GitHub', async () => {
    const repoRoot = createTemporaryDirectory();
    const sourceRoot = createTemporaryDirectory();
    writeSourceRegistry(repoRoot, sourceRoot);
    fs.mkdirSync(path.join(sourceRoot, 'atlas', 'items'), { recursive: true });
    fs.mkdirSync(path.join(sourceRoot, 'plans', 'next'), { recursive: true });
    fs.writeFileSync(path.join(sourceRoot, 'atlas', 'items', 'product.md'), '# Product');
    fs.writeFileSync(path.join(sourceRoot, 'plans', 'next', '12-bridge.md'), '# Bridge');
    const fetcher = vi.fn();

    await expect(loadAtlasSourceFiles({ fetcher, repoRoot })).resolves.toEqual([
      { path: 'plans/next/12-bridge.md', content: '# Bridge', source: 'product' },
      { path: 'atlas/items/product.md', content: '# Product', source: 'product' },
    ]);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('loads public GitHub Markdown when the sibling checkout is unavailable', async () => {
    const repoRoot = createTemporaryDirectory();
    writeSourceRegistry(repoRoot, '../missing-product');
    const fetcher = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);

      if (url.includes('/git/trees/')) {
        return Response.json({
          tree: [
            { path: 'atlas/items/product.md', type: 'blob' },
            { path: 'plans/next/12-bridge.md', type: 'blob' },
            { path: 'packages/core/package.json', type: 'blob' },
          ],
        });
      }

      return new Response(url.includes('atlas/items') ? '# Product' : '# Bridge');
    }) as typeof fetch;

    await expect(loadAtlasSourceFiles({ fetcher, repoRoot })).resolves.toEqual([
      { path: 'atlas/items/product.md', content: '# Product', source: 'product' },
      { path: 'plans/next/12-bridge.md', content: '# Bridge', source: 'product' },
    ]);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it('accepts deployment source configuration from the environment', async () => {
    const repoRoot = createTemporaryDirectory();
    const sourceRoot = createTemporaryDirectory();
    fs.mkdirSync(path.join(sourceRoot, 'plans', 'current'), { recursive: true });
    fs.writeFileSync(path.join(sourceRoot, 'plans', 'current', '7-index.md'), '# Index');
    process.env.ATLAS_SOURCES_YAML = `version: 1
sources:
  knowledge:
    repository: https://github.com/acme/knowledge
    localRoot: ${sourceRoot}
    ref: main
`;

    await expect(loadAtlasSourceFiles({ repoRoot })).resolves.toEqual([
      { path: 'plans/current/7-index.md', content: '# Index', source: 'knowledge' },
    ]);
  });
});
