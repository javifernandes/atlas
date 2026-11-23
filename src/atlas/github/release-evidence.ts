import { getAtlasGitHubRequestHeaders } from './installation-client';
import {
  type AtlasEvidenceBindingKind,
  type AtlasGitHubEvidenceSource,
  listAtlasGitHubEvidenceSources,
} from './pull-request-evidence';
import { githubRepositoryCacheTag } from './repository';

export type AtlasReleaseDirective = {
  kind: AtlasEvidenceBindingKind;
  target: string;
};

export type AtlasObservedComponentVersion = {
  commitShas: string[];
  directives: AtlasReleaseDirective[];
  id: string;
  notes: string;
  packageName: string;
  version: string;
};

export type AtlasObservedRelease = {
  componentVersions: AtlasObservedComponentVersion[];
  id: string;
  name: string;
  prerelease: boolean;
  publishedAt: string;
  repositoryFullName: string;
  sourceId: string;
  tagName: string;
  url: string;
};

type GitHubRelease = {
  body?: unknown;
  draft?: unknown;
  html_url?: unknown;
  id?: unknown;
  name?: unknown;
  prerelease?: unknown;
  published_at?: unknown;
  tag_name?: unknown;
};

const packageVersionHeadingPattern = /^##\s+(.+)@([^\s@]+)\s*$/gm;
const releaseDirectivePattern = /\b(Implements|Shapes)\s+`([^`]+)`/gim;
const changesetCommitPattern = /^-\s+([0-9a-f]{7,40}):\s+/gim;

const parseReleaseDirectives = (notes: string) =>
  [...notes.matchAll(releaseDirectivePattern)].map(match => ({
    kind: match[1]?.toLowerCase() === 'shapes' ? ('shapes' as const) : ('implements' as const),
    target: match[2]?.trim() ?? '',
  })).filter(directive => directive.target);

export const parseAtlasReleaseNotes = (input: {
  body: string;
  releaseId: string;
}) => {
  const headings = [...input.body.matchAll(packageVersionHeadingPattern)];

  return headings.flatMap((heading, index) => {
    const packageName = heading[1]?.trim();
    const version = heading[2]?.trim();

    if (!packageName || !version || heading.index === undefined) return [];

    const notesStart = heading.index + heading[0].length;
    const notesEnd = headings[index + 1]?.index ?? input.body.length;
    const notes = input.body.slice(notesStart, notesEnd).trim();

    return [
      {
        commitShas: [...notes.matchAll(changesetCommitPattern)].flatMap(match =>
          match[1] ? [match[1].toLowerCase()] : [],
        ),
        directives: parseReleaseDirectives(notes),
        id: `${input.releaseId}:${packageName}@${version}`,
        notes,
        packageName,
        version,
      },
    ];
  });
};

const mapRelease = (
  release: GitHubRelease,
  source: AtlasGitHubEvidenceSource,
): AtlasObservedRelease | null => {
  if (
    release.draft === true ||
    (typeof release.id !== 'number' && typeof release.id !== 'string') ||
    typeof release.tag_name !== 'string' ||
    typeof release.html_url !== 'string' ||
    typeof release.published_at !== 'string'
  ) {
    return null;
  }

  const id = `github-release:${source.repositoryFullName.toLowerCase()}#${release.id}`;
  const body = typeof release.body === 'string' ? release.body : '';

  return {
    componentVersions: parseAtlasReleaseNotes({ body, releaseId: id }),
    id,
    name:
      typeof release.name === 'string' && release.name.trim()
        ? release.name.trim()
        : release.tag_name,
    prerelease: release.prerelease === true,
    publishedAt: release.published_at,
    repositoryFullName: source.repositoryFullName,
    sourceId: source.sourceId,
    tagName: release.tag_name,
    url: release.html_url,
  };
};

export const fetchAtlasReleaseEvidence = async (input: {
  fetcher?: typeof fetch;
  maxPages?: number;
  source: AtlasGitHubEvidenceSource;
}) => {
  const fetcher = input.fetcher ?? fetch;
  const maxPages = input.maxPages ?? 5;
  const pageSize = 50;
  const headers = await getAtlasGitHubRequestHeaders({
    fetcher,
    repositoryFullName: input.source.repositoryFullName,
  });
  const releases: AtlasObservedRelease[] = [];

  for (let page = 1; page <= maxPages; page += 1) {
    const url = new URL(
      `/repos/${input.source.repositoryFullName}/releases`,
      'https://api.github.com',
    );
    url.searchParams.set('per_page', String(pageSize));
    url.searchParams.set('page', String(page));

    const response = await fetcher(url, {
      headers,
      next: {
        revalidate: 300,
        tags: [githubRepositoryCacheTag(input.source.repositoryFullName)],
      },
    });

    if (!response.ok) {
      throw new Error(
        `GitHub release request failed for ${input.source.repositoryFullName} with ${response.status}`,
      );
    }

    const body: unknown = await response.json();
    if (!Array.isArray(body)) {
      throw new Error(`GitHub returned an invalid release list for ${input.source.repositoryFullName}`);
    }

    releases.push(
      ...body.flatMap(release => {
        if (!release || typeof release !== 'object') return [];
        const mapped = mapRelease(release, input.source);
        return mapped ? [mapped] : [];
      }),
    );

    if (body.length < pageSize) break;
  }

  return releases;
};

export const loadAtlasReleaseEvidenceObservation = async (input: {
  fetcher?: typeof fetch;
  repoRoot: string;
}) => {
  const sources = listAtlasGitHubEvidenceSources(input.repoRoot);
  const results = await Promise.allSettled(
    sources.map(source =>
      fetchAtlasReleaseEvidence({
        fetcher: input.fetcher,
        source,
      }),
    ),
  );

  const failures = results.flatMap((result, index) =>
    result.status === 'rejected'
      ? [
          {
            repositoryFullName: sources[index]?.repositoryFullName ?? 'unknown source',
            sourceId: sources[index]?.sourceId ?? 'unknown',
            message: result.reason instanceof Error ? result.reason.message : String(result.reason),
          },
        ]
      : [],
  );
  const releases = results.flatMap(result =>
    result.status === 'fulfilled' ? result.value : [],
  );

  return { failures, releases };
};
