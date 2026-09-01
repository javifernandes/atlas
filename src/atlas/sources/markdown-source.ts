import fs from 'node:fs';
import path from 'node:path';

import { getAtlasGitHubRequestHeaders } from '../github/installation-client';
import {
  githubRepositoryCacheTag,
  parseGitHubRepositoryName,
} from '../github/repository';

export type AtlasMarkdownFile = {
  path: string;
  content: string;
  source?: string;
};

export type AtlasSource = {
  id: string;
  repository: string;
  localRoot?: string;
  ref: string;
};

type GithubTree = {
  tree?: Array<{ path?: string; type?: string }>;
  truncated?: boolean;
};

type LoadAtlasSourcesInput = {
  fetcher?: typeof fetch;
  repoRoot: string;
};

export const parseAtlasSources = (content: string): AtlasSource[] => {
  const sources = new Map<string, Omit<AtlasSource, 'id'>>();
  let currentSource: string | undefined;

  for (const line of content.replaceAll('\r\n', '\n').split('\n')) {
    const sourceMatch = line.match(/^  ([a-z][a-z0-9-]*):\s*$/i);

    if (sourceMatch?.[1]) {
      currentSource = sourceMatch[1];

      if (currentSource === 'atlas') {
        throw new Error('The atlas source id is reserved for repository-owned documents');
      }

      sources.set(currentSource, { repository: '', ref: 'main' });
      continue;
    }

    const propertyMatch = line.match(/^    ([A-Za-z][A-Za-z0-9]*):\s*(.+?)\s*$/);
    const source = currentSource ? sources.get(currentSource) : undefined;

    if (!propertyMatch?.[1] || !propertyMatch[2] || !source) {
      continue;
    }

    const value = propertyMatch[2].replace(/^['"]|['"]$/g, '');

    if (propertyMatch[1] === 'repository') {
      source.repository = value;
    } else if (propertyMatch[1] === 'localRoot') {
      source.localRoot = value;
    } else if (propertyMatch[1] === 'ref') {
      source.ref = value;
    }
  }

  return [...sources].flatMap(([id, source]) => (source.repository ? [{ id, ...source }] : []));
};

const walkMarkdownFiles = (
  directory: string,
  sourceRoot: string,
  source?: string,
): AtlasMarkdownFile[] => {
  if (!fs.existsSync(directory)) {
    return [];
  }

  return fs
    .readdirSync(directory, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name))
    .flatMap(entry => {
      const fullPath = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        return walkMarkdownFiles(fullPath, sourceRoot, source);
      }

      return entry.isFile() && entry.name.endsWith('.md')
        ? [
            {
              path: path.relative(sourceRoot, fullPath).replaceAll(path.sep, '/'),
              content: fs.readFileSync(fullPath, 'utf8'),
              source,
            },
          ]
        : [];
    });
};

export const walkLocalAtlasMarkdownFiles = (
  directory: string,
  sourceRoot: string,
  source?: string,
) => walkMarkdownFiles(directory, sourceRoot, source);

const isAtlasSourceMarkdownPath = (filePath: string) =>
  (filePath.startsWith('atlas/items/') || filePath.startsWith('plans/')) &&
  filePath.endsWith('.md');

const fetchGithubSourceFiles = async (source: AtlasSource, fetcher: typeof fetch) => {
  const repositoryName = parseGitHubRepositoryName(source.repository);

  if (!repositoryName) {
    throw new Error(`Unsupported Atlas source repository: ${source.repository}`);
  }

  const headers = await getAtlasGitHubRequestHeaders({
    repositoryFullName: repositoryName,
    fetcher,
  });
  const cacheTag = githubRepositoryCacheTag(repositoryName);

  const treeResponse = await fetcher(
    `https://api.github.com/repos/${repositoryName}/git/trees/${encodeURIComponent(source.ref)}?recursive=1`,
    {
      headers,
      next: { revalidate: 300, tags: [cacheTag] },
    },
  );

  if (!treeResponse.ok) {
    throw new Error(`GitHub tree request failed with ${treeResponse.status}`);
  }

  const tree = (await treeResponse.json()) as GithubTree;

  if (tree.truncated) {
    throw new Error(`GitHub tree for ${source.id} was truncated`);
  }

  const paths = (tree.tree ?? [])
    .filter(entry => entry.type === 'blob' && entry.path && isAtlasSourceMarkdownPath(entry.path))
    .map(entry => entry.path as string);
  const files = await Promise.all(
    paths.map(async filePath => {
      const response = await fetcher(
        `https://raw.githubusercontent.com/${repositoryName}/${encodeURIComponent(source.ref)}/${filePath}`,
        { headers, next: { revalidate: 300, tags: [cacheTag] } },
      );

      if (!response.ok) {
        throw new Error(`GitHub source request failed for ${filePath} with ${response.status}`);
      }

      return { path: filePath, content: await response.text(), source: source.id };
    }),
  );

  return files;
};

const loadAtlasSource = async (source: AtlasSource, repoRoot: string, fetcher: typeof fetch) => {
  const localRoot = source.localRoot ? path.resolve(repoRoot, source.localRoot) : undefined;

  if (
    localRoot &&
    (fs.existsSync(path.join(localRoot, 'atlas', 'items')) ||
      fs.existsSync(path.join(localRoot, 'plans')))
  ) {
    return [
      ...walkMarkdownFiles(path.join(localRoot, 'plans'), localRoot, source.id),
      ...walkMarkdownFiles(path.join(localRoot, 'atlas', 'items'), localRoot, source.id),
    ];
  }

  return fetchGithubSourceFiles(source, fetcher);
};

export const readAtlasSourceRegistry = (repoRoot: string) => {
  if (process.env.ATLAS_SOURCES_YAML) {
    return process.env.ATLAS_SOURCES_YAML;
  }

  const registryPath = [
    path.join(repoRoot, 'atlas.sources.local.yaml'),
    path.join(repoRoot, 'atlas.sources.yaml'),
    path.join(repoRoot, 'atlas', 'sources.yaml'),
  ].find(candidate => fs.existsSync(candidate));

  return registryPath ? fs.readFileSync(registryPath, 'utf8') : undefined;
};

export const loadAtlasSourceDefinitions = (repoRoot: string) => {
  const registry = readAtlasSourceRegistry(repoRoot);

  return registry ? parseAtlasSources(registry) : [];
};

const loadAtlasOwnedFiles = (repoRoot: string) => [
  ...walkMarkdownFiles(path.join(repoRoot, 'plans'), repoRoot, 'atlas'),
  ...walkMarkdownFiles(path.join(repoRoot, 'atlas', 'items'), repoRoot, 'atlas'),
];

export const loadAtlasSourceFiles = async ({
  fetcher = fetch,
  repoRoot,
}: LoadAtlasSourcesInput) => {
  const atlasOwnedFiles = loadAtlasOwnedFiles(repoRoot);
  const sources = loadAtlasSourceDefinitions(repoRoot);

  return [
    ...(await Promise.all(sources.map(source => loadAtlasSource(source, repoRoot, fetcher)))).flat(),
    ...atlasOwnedFiles,
  ];
};
