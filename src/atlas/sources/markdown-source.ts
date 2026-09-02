import { createHash } from 'node:crypto';
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
  sourceRepository?: string;
  sourceRevision?: string;
  sourceRevisionKind?: 'git' | 'content-sha256';
};

export type AtlasLoadedSourceRevision = {
  authority: 'markdown';
  id: string;
  observedAt: string;
  repository: string | null;
  revision: string;
  revisionKind: 'git' | 'content-sha256';
  sourceId: string;
};

export type AtlasSource = {
  id: string;
  repository: string;
  localRoot?: string;
  ref: string;
};

type GithubTree = {
  sha?: string;
  tree?: Array<{ path?: string; sha?: string; type?: string }>;
  truncated?: boolean;
};

type GithubGraphQlBlobResponse = {
  data?: {
    repository?: Record<string, { text?: unknown } | null> | null;
  };
  errors?: unknown;
};

type LoadAtlasSourcesInput = {
  fetcher?: typeof fetch;
  preferRemoteAtlas?: boolean;
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

const contentRevision = (files: AtlasMarkdownFile[]) =>
  createHash('sha256')
    .update(
      files
        .map(file => `${file.path}\0${file.content}`)
        .sort((left, right) => left.localeCompare(right))
        .join('\0'),
    )
    .digest('hex');

const withSourceRevision = (
  files: AtlasMarkdownFile[],
  input: {
    repository: string | null;
    revision?: string;
    revisionKind?: 'git' | 'content-sha256';
    sourceId: string;
  },
) => {
  const revision = input.revision ?? contentRevision(files);
  const revisionKind = input.revisionKind ?? 'content-sha256';

  return files.map(file => ({
    ...file,
    source: input.sourceId,
    sourceRepository: input.repository ?? undefined,
    sourceRevision: revision,
    sourceRevisionKind: revisionKind,
  }));
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

  const blobs = (tree.tree ?? []).filter(
    entry => entry.type === 'blob' && entry.path && isAtlasSourceMarkdownPath(entry.path),
  );
  if (!headers.Authorization) {
    const observedRevision = tree.sha ?? source.ref;
    const publicFiles = await Promise.all(
      blobs.map(async blobEntry => {
        const filePath = blobEntry.path!;
        const response = await fetcher(
          `https://raw.githubusercontent.com/${repositoryName}/${encodeURIComponent(observedRevision)}/${filePath}`,
          { headers, next: { revalidate: 300, tags: [cacheTag] } },
        );

        if (!response.ok) {
          throw new Error(`GitHub source request failed for ${filePath} with ${response.status}`);
        }

        return { path: filePath, content: await response.text(), source: source.id };
      }),
    );

    return withSourceRevision(publicFiles, {
      sourceId: source.id,
      repository: repositoryName,
      revision: tree.sha,
      revisionKind: tree.sha ? 'git' : undefined,
    });
  }

  const [owner, name] = repositoryName.split('/');
  const files: AtlasMarkdownFile[] = [];

  for (let offset = 0; offset < blobs.length; offset += 50) {
    const batch = blobs.slice(offset, offset + 50);
    const variables: Record<string, string> = { owner: owner!, name: name! };
    const variableDeclarations = ['$owner: String!', '$name: String!'];
    const selections = batch.map((blobEntry, index) => {
      if (!blobEntry.sha) {
        throw new Error(`GitHub tree entry ${blobEntry.path} has no blob revision`);
      }

      const variableName = `expression${index}`;
      variables[variableName] = blobEntry.sha;
      variableDeclarations.push(`$${variableName}: String!`);
      return `blob${index}: object(expression: $${variableName}) { ... on Blob { text } }`;
    });
    const response = await fetcher('https://api.github.com/graphql', {
      body: JSON.stringify({
        query: `query(${variableDeclarations.join(', ')}) { repository(owner: $owner, name: $name) { ${selections.join(' ')} } }`,
        variables,
      }),
      headers: { ...headers, 'Content-Type': 'application/json' },
      method: 'POST',
      next: { revalidate: 300, tags: [cacheTag] },
    });

    if (!response.ok) {
      throw new Error(`GitHub source blob request failed with ${response.status}`);
    }

    const body = (await response.json()) as GithubGraphQlBlobResponse;
    const repository = body.data?.repository;
    if (body.errors || !repository) {
      throw new Error(`GitHub returned an invalid blob response for ${source.id}`);
    }

    batch.forEach((blobEntry, index) => {
      const content = repository[`blob${index}`]?.text;
      if (typeof content !== 'string') {
        throw new Error(`GitHub returned an invalid blob for ${blobEntry.path}`);
      }

      files.push({ path: blobEntry.path!, content, source: source.id });
    });
  }

  return withSourceRevision(files, {
    sourceId: source.id,
    repository: repositoryName,
    revision: tree.sha,
    revisionKind: tree.sha ? 'git' : undefined,
  });
};

const loadAtlasSource = async (source: AtlasSource, repoRoot: string, fetcher: typeof fetch) => {
  const localRoot = source.localRoot ? path.resolve(repoRoot, source.localRoot) : undefined;

  if (
    localRoot &&
    (fs.existsSync(path.join(localRoot, 'atlas', 'items')) ||
      fs.existsSync(path.join(localRoot, 'plans')))
  ) {
    const files = [
      ...walkMarkdownFiles(path.join(localRoot, 'plans'), localRoot, source.id),
      ...walkMarkdownFiles(path.join(localRoot, 'atlas', 'items'), localRoot, source.id),
    ];

    return withSourceRevision(files, {
      sourceId: source.id,
      repository: parseGitHubRepositoryName(source.repository),
    });
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

const getAtlasRepository = () =>
  process.env.ATLAS_GITHUB_REPOSITORY?.trim() ??
  (process.env.VERCEL_GIT_REPO_OWNER && process.env.VERCEL_GIT_REPO_SLUG
    ? `${process.env.VERCEL_GIT_REPO_OWNER}/${process.env.VERCEL_GIT_REPO_SLUG}`
    : 'javifernandes/atlas');

const loadAtlasOwnedFiles = async (input: LoadAtlasSourcesInput) => {
  const repository = getAtlasRepository();

  if (input.preferRemoteAtlas) {
    return fetchGithubSourceFiles(
      {
        id: 'atlas',
        repository,
        ref: process.env.ATLAS_GITHUB_REF?.trim() || 'main',
      },
      input.fetcher ?? fetch,
    );
  }

  const { repoRoot } = input;
  const files = [
    ...walkMarkdownFiles(path.join(repoRoot, 'plans'), repoRoot, 'atlas'),
    ...walkMarkdownFiles(path.join(repoRoot, 'atlas', 'items'), repoRoot, 'atlas'),
  ];
  const revision =
    process.env.VERCEL_GIT_COMMIT_SHA?.trim() ?? process.env.GITHUB_SHA?.trim();

  return withSourceRevision(files, {
    sourceId: 'atlas',
    repository,
    revision,
    revisionKind: revision ? 'git' : undefined,
  });
};

const loadAtlasSourceFilesWithRevision = async ({
  fetcher = fetch,
  preferRemoteAtlas,
  repoRoot,
}: LoadAtlasSourcesInput) => {
  const sources = loadAtlasSourceDefinitions(repoRoot);
  const atlasOwnedFiles = await loadAtlasOwnedFiles({
    fetcher,
    preferRemoteAtlas,
    repoRoot,
  });

  return [
    ...(await Promise.all(sources.map(source => loadAtlasSource(source, repoRoot, fetcher)))).flat(),
    ...atlasOwnedFiles,
  ];
};

export const loadAtlasSourceFiles = async (input: LoadAtlasSourcesInput) =>
  (await loadAtlasSourceFilesWithRevision(input)).map(file => ({
    path: file.path,
    content: file.content,
    source: file.source,
  }));

export const extractAtlasSourceRevisions = (
  files: AtlasMarkdownFile[],
  observedAt = new Date().toISOString(),
): AtlasLoadedSourceRevision[] => [
  ...new Map(
    files.flatMap(file => {
      const sourceId = file.source ?? 'atlas';
      const revision = file.sourceRevision;

      if (!revision) {
        return [];
      }

      const value: AtlasLoadedSourceRevision = {
        id: `${sourceId}:markdown:${revision}`,
        sourceId,
        repository: file.sourceRepository ?? null,
        authority: 'markdown',
        revision,
        revisionKind: file.sourceRevisionKind ?? 'content-sha256',
        observedAt,
      };

      return [[sourceId, value] as const];
    }),
  ).values(),
];

export const loadAtlasSourceObservation = async (input: LoadAtlasSourcesInput) => {
  const observedAt = new Date().toISOString();
  const files = await loadAtlasSourceFilesWithRevision(input);

  return {
    files,
    observedAt,
    sourceRevisions: extractAtlasSourceRevisions(files, observedAt),
  };
};
