import fs from 'node:fs';
import path from 'node:path';

import { getAtlasGitHubRequestHeaders } from './installation-client';
import { githubRepositoryCacheTag, parseGitHubRepositoryName } from './repository';
import { loadAtlasSourceDefinitions } from '../sources/markdown-source';

export type AtlasEvidenceBindingKind = 'implements' | 'shapes';

export type AtlasPullRequestDirective = {
  kind: AtlasEvidenceBindingKind;
  target: string;
};

export type AtlasObservedPullRequest = {
  authorAvatarUrl: string | null;
  authorLogin: string | null;
  directives: AtlasPullRequestDirective[];
  id: string;
  mergeCommitSha: string | null;
  mergedByAvatarUrl: string | null;
  mergedByLogin: string | null;
  mergedAt: string;
  number: number;
  repositoryFullName: string;
  sourceId: string;
  title: string;
  url: string;
};

export type AtlasGitHubEvidenceSource = {
  repositoryFullName: string;
  sourceId: string;
};

type GitHubPullRequest = {
  body?: unknown;
  html_url?: unknown;
  merge_commit_sha?: unknown;
  merged_by?: unknown;
  merged_at?: unknown;
  number?: unknown;
  title?: unknown;
  user?: unknown;
};

const directivePattern = /^Atlas-(Implements|Shapes)\s*:\s*(.*)$/i;
const inlineSeparatorPattern = /\s*[,;]\s*/;

const normalizeDirectiveTarget = (value: string) => {
  const trimmed = value.trim().replace(/^[-*+]\s+/, '').trim();
  const markdownLink = trimmed.match(/^\[[^\]]+\]\(([^)]+)\)$/);
  const target = (markdownLink?.[1] ?? trimmed).replace(/^`|`$/g, '').trim();

  return target.replace(/[.,;]+$/, '');
};

const addDirectiveTargets = (
  directives: AtlasPullRequestDirective[],
  kind: AtlasEvidenceBindingKind,
  value: string,
) => {
  for (const candidate of value.split(inlineSeparatorPattern)) {
    const target = normalizeDirectiveTarget(candidate);

    if (target && !directives.some(entry => entry.kind === kind && entry.target === target)) {
      directives.push({ kind, target });
    }
  }
};

export const parseAtlasPullRequestDirectives = (body: string | null | undefined) => {
  const directives: AtlasPullRequestDirective[] = [];
  let activeKind: AtlasEvidenceBindingKind | null = null;

  for (const sourceLine of body?.replaceAll('\r\n', '\n').split('\n') ?? []) {
    const line = sourceLine.trim();
    const directive = line.match(directivePattern);

    if (directive?.[1] !== undefined && directive[2] !== undefined) {
      activeKind = directive[1].toLowerCase() === 'implements' ? 'implements' : 'shapes';

      if (directive[2].trim()) {
        addDirectiveTargets(directives, activeKind, directive[2]);
        activeKind = null;
      }

      continue;
    }

    if (activeKind && /^[-*+]\s+/.test(line)) {
      addDirectiveTargets(directives, activeKind, line);
      continue;
    }

    if (!line) {
      activeKind = null;
      continue;
    }

    activeKind = null;
  }

  return directives;
};

const getAtlasRepository = (repoRoot: string) => {
  const configured = process.env.ATLAS_GITHUB_REPOSITORY?.trim();

  if (configured) {
    return parseGitHubRepositoryName(configured);
  }

  const vercelOwner = process.env.VERCEL_GIT_REPO_OWNER?.trim();
  const vercelSlug = process.env.VERCEL_GIT_REPO_SLUG?.trim();

  if (vercelOwner && vercelSlug) {
    return parseGitHubRepositoryName(`${vercelOwner}/${vercelSlug}`);
  }

  try {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'),
    ) as unknown;

    if (!packageJson || typeof packageJson !== 'object' || !('repository' in packageJson)) {
      return null;
    }

    const repository = packageJson.repository;
    const repositoryUrl =
      typeof repository === 'string'
        ? repository
        : repository &&
            typeof repository === 'object' &&
            'url' in repository &&
            typeof repository.url === 'string'
          ? repository.url
          : null;

    return repositoryUrl ? parseGitHubRepositoryName(repositoryUrl) : null;
  } catch {
    return null;
  }
};

export const listAtlasGitHubEvidenceSources = (repoRoot: string) => {
  const sources = loadAtlasSourceDefinitions(repoRoot).flatMap(source => {
    const repositoryFullName = parseGitHubRepositoryName(source.repository);

    return repositoryFullName ? [{ sourceId: source.id, repositoryFullName }] : [];
  });
  const atlasRepository = getAtlasRepository(repoRoot);

  if (atlasRepository) {
    sources.push({ sourceId: 'atlas', repositoryFullName: atlasRepository });
  }

  return [
    ...new Map(
      sources.map(source => [source.repositoryFullName.toLowerCase(), source] as const),
    ).values(),
  ];
};

const optionalString = (value: unknown) => (typeof value === 'string' ? value : null);

const readGitHubUser = (value: unknown) => {
  if (!value || typeof value !== 'object') {
    return { avatarUrl: null, login: null };
  }

  return {
    avatarUrl: 'avatar_url' in value ? optionalString(value.avatar_url) : null,
    login: 'login' in value ? optionalString(value.login) : null,
  };
};

const mapPullRequest = (
  pullRequest: GitHubPullRequest,
  source: AtlasGitHubEvidenceSource,
): AtlasObservedPullRequest | null => {
  if (
    typeof pullRequest.number !== 'number' ||
    typeof pullRequest.title !== 'string' ||
    typeof pullRequest.html_url !== 'string' ||
    typeof pullRequest.merged_at !== 'string'
  ) {
    return null;
  }

  const directives = parseAtlasPullRequestDirectives(optionalString(pullRequest.body));

  if (directives.length === 0) {
    return null;
  }

  const author = readGitHubUser(pullRequest.user);
  const mergedBy = readGitHubUser(pullRequest.merged_by);

  return {
    authorAvatarUrl: author.avatarUrl,
    authorLogin: author.login,
    directives,
    id: `github:${source.repositoryFullName.toLowerCase()}#${pullRequest.number}`,
    mergeCommitSha: optionalString(pullRequest.merge_commit_sha),
    mergedByAvatarUrl: mergedBy.avatarUrl,
    mergedByLogin: mergedBy.login,
    mergedAt: pullRequest.merged_at,
    number: pullRequest.number,
    repositoryFullName: source.repositoryFullName,
    sourceId: source.sourceId,
    title: pullRequest.title,
    url: pullRequest.html_url,
  };
};

export const fetchAtlasPullRequestEvidence = async (input: {
  fetcher?: typeof fetch;
  maxPages?: number;
  source: AtlasGitHubEvidenceSource;
}) => {
  const fetcher = input.fetcher ?? fetch;
  const maxPages = input.maxPages ?? 20;
  const pageSize = 25;
  const headers = await getAtlasGitHubRequestHeaders({
    fetcher,
    repositoryFullName: input.source.repositoryFullName,
  });
  const evidence: AtlasObservedPullRequest[] = [];

  const hydrateMergeActor = async (pullRequest: AtlasObservedPullRequest) => {
    if (pullRequest.mergedByLogin || pullRequest.mergedByAvatarUrl) {
      return pullRequest;
    }

    const url = new URL(
      `/repos/${input.source.repositoryFullName}/pulls/${pullRequest.number}`,
      'https://api.github.com',
    );
    try {
      const response = await fetcher(url, {
        headers,
        next: {
          revalidate: 300,
          tags: [githubRepositoryCacheTag(input.source.repositoryFullName)],
        },
      });

      if (!response.ok) {
        return pullRequest;
      }

      const body: unknown = await response.json();

      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return pullRequest;
      }

      return mapPullRequest(body, input.source) ?? pullRequest;
    } catch {
      return pullRequest;
    }
  };

  for (let page = 1; page <= maxPages; page += 1) {
    const url = new URL(
      `/repos/${input.source.repositoryFullName}/pulls`,
      'https://api.github.com',
    );
    url.searchParams.set('state', 'closed');
    url.searchParams.set('sort', 'updated');
    url.searchParams.set('direction', 'desc');
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
        `GitHub pull request request failed for ${input.source.repositoryFullName} with ${response.status}`,
      );
    }

    const body: unknown = await response.json();

    if (!Array.isArray(body)) {
      throw new Error(
        `GitHub returned an invalid pull request list for ${input.source.repositoryFullName}`,
      );
    }

    const pageEvidence = body.flatMap(pullRequest => {
      if (!pullRequest || typeof pullRequest !== 'object') {
        return [];
      }

      const mapped = mapPullRequest(pullRequest, input.source);

      return mapped ? [mapped] : [];
    });

    evidence.push(...(await Promise.all(pageEvidence.map(hydrateMergeActor))));

    if (body.length < pageSize) {
      break;
    }
  }

  return evidence;
};

export const loadAtlasPullRequestEvidenceObservation = async (input: {
  fetcher?: typeof fetch;
  repoRoot: string;
}) => {
  const sources = listAtlasGitHubEvidenceSources(input.repoRoot);
  const results = await Promise.allSettled(
    sources.map(source =>
      fetchAtlasPullRequestEvidence({
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
  const successfulSources = results.flatMap((result, index) =>
    result.status === 'fulfilled' && sources[index] ? [sources[index]] : [],
  );
  const pullRequests = results.flatMap(result =>
    result.status === 'fulfilled' ? result.value : [],
  );

  return { failures, pullRequests, successfulSources };
};

export const loadAtlasPullRequestEvidence = async (input: {
  fetcher?: typeof fetch;
  repoRoot: string;
  strict?: boolean;
}) => {
  const observation = await loadAtlasPullRequestEvidenceObservation(input);

  if (input.strict && observation.failures.length > 0) {
    throw new Error(
      `Atlas PR evidence reconciliation failed (${observation.failures
        .map(failure => `${failure.repositoryFullName}: ${failure.message}`)
        .join('; ')}).`,
    );
  }

  for (const failure of observation.failures) {
    process.stderr.write(
      `Failed to load Atlas PR evidence from ${failure.repositoryFullName}: ${failure.message}\n`,
    );
  }

  return observation.pullRequests;
};
