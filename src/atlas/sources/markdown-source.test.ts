import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { loadAtlasSourceFiles, parseAtlasSources } from './markdown-source';

const temporaryDirectories: string[] = [];
const originalSourcesYaml = process.env.ATLAS_SOURCES_YAML;
const originalAtlasRepository = process.env.ATLAS_GITHUB_REPOSITORY;
const originalAtlasRef = process.env.ATLAS_GITHUB_REF;
const originalAtlasToken = process.env.ATLAS_GITHUB_TOKEN;

const restoreEnvironment = (name: string, value: string | undefined) => {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
};

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
  restoreEnvironment('ATLAS_SOURCES_YAML', originalSourcesYaml);
  restoreEnvironment('ATLAS_GITHUB_REPOSITORY', originalAtlasRepository);
  restoreEnvironment('ATLAS_GITHUB_REF', originalAtlasRef);
  restoreEnvironment('ATLAS_GITHUB_TOKEN', originalAtlasToken);

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

  it('reserves the atlas source id for repository-owned documents', () => {
    expect(() =>
      parseAtlasSources(`version: 1
sources:
  atlas:
    repository: https://github.com/acme/atlas-copy
    ref: main
`),
    ).toThrow('The atlas source id is reserved for repository-owned documents');
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
    const requestedUrls: string[] = [];
    const fetcher = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      requestedUrls.push(url);

      if (url.includes('/git/trees/')) {
        return Response.json({
          sha: 'observed-sha',
          tree: [
            { path: 'atlas/items/product.md', sha: 'product-blob', type: 'blob' },
            { path: 'plans/next/12-bridge.md', sha: 'bridge-blob', type: 'blob' },
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
    expect(
      requestedUrls.slice(1).every(url => url.includes('/observed-sha/')),
    ).toBe(true);
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

  it('always loads Atlas-owned plans and items from the application repository', async () => {
    const repoRoot = createTemporaryDirectory();
    fs.mkdirSync(path.join(repoRoot, 'atlas', 'items'), { recursive: true });
    fs.mkdirSync(path.join(repoRoot, 'plans', 'current'), { recursive: true });
    fs.writeFileSync(path.join(repoRoot, 'atlas', 'items', 'atlas.md'), '# Atlas');
    fs.writeFileSync(path.join(repoRoot, 'plans', 'current', '1-atlas.md'), '# Atlas Plan');

    await expect(loadAtlasSourceFiles({ repoRoot })).resolves.toEqual([
      { path: 'plans/current/1-atlas.md', content: '# Atlas Plan', source: 'atlas' },
      { path: 'atlas/items/atlas.md', content: '# Atlas', source: 'atlas' },
    ]);
  });

  it('pins hosted Atlas source reads to the observed Git tree revision', async () => {
    const repoRoot = createTemporaryDirectory();
    fs.mkdirSync(path.join(repoRoot, 'plans', 'current'), { recursive: true });
    fs.writeFileSync(path.join(repoRoot, 'plans', 'current', '1-atlas.md'), '# Stale deployment');
    process.env.ATLAS_GITHUB_REPOSITORY = 'acme/atlas';
    process.env.ATLAS_GITHUB_REF = 'main';
    process.env.ATLAS_GITHUB_TOKEN = 'test-token';
    const requestedUrls: string[] = [];
    const fetcher = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      requestedUrls.push(url);

      return url.includes('/git/trees/')
        ? Response.json({
            sha: 'atlas-observed-sha',
            tree: [
              {
                path: 'plans/current/1-atlas.md',
                sha: 'atlas-file-blob',
                type: 'blob',
              },
            ],
          })
        : Response.json({
            data: { repository: { blob0: { text: '# Authoritative remote' } } },
          });
    }) as typeof fetch;

    await expect(
      loadAtlasSourceFiles({ fetcher, preferRemoteAtlas: true, repoRoot }),
    ).resolves.toEqual([
      {
        path: 'plans/current/1-atlas.md',
        content: '# Authoritative remote',
        source: 'atlas',
      },
    ]);
    expect(requestedUrls[1]).toBe('https://api.github.com/graphql');
  });

  it('loads intrinsic Atlas documents after configured sources so they have ownership precedence', async () => {
    const repoRoot = createTemporaryDirectory();
    const sourceRoot = createTemporaryDirectory();
    writeSourceRegistry(repoRoot, sourceRoot);
    fs.mkdirSync(path.join(repoRoot, 'atlas', 'items'), { recursive: true });
    fs.mkdirSync(path.join(sourceRoot, 'atlas', 'items'), { recursive: true });
    fs.writeFileSync(path.join(repoRoot, 'atlas', 'items', 'shared.md'), '# Atlas-owned');
    fs.writeFileSync(path.join(sourceRoot, 'atlas', 'items', 'shared.md'), '# External copy');

    await expect(loadAtlasSourceFiles({ repoRoot })).resolves.toEqual([
      { path: 'atlas/items/shared.md', content: '# External copy', source: 'product' },
      { path: 'atlas/items/shared.md', content: '# Atlas-owned', source: 'atlas' },
    ]);
  });
});
