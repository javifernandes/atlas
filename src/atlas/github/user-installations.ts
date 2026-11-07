import type { AtlasGitHubRepositoryChoice } from './user-repositories';

const headers = (accessToken: string) => ({
  Accept: 'application/vnd.github+json',
  Authorization: `Bearer ${accessToken}`,
  'User-Agent': 'atlas-github-source-picker',
  'X-GitHub-Api-Version': '2022-11-28',
});

export const listAtlasGitHubInstallationRepositories = async (input: {
  accessToken: string;
  fetcher?: typeof fetch;
  installationUrl: string | null;
}) => {
  const fetcher = input.fetcher ?? fetch;
  const installationsResponse = await fetcher(
    'https://api.github.com/user/installations?per_page=100',
    { cache: 'no-store', headers: headers(input.accessToken) },
  );
  if (installationsResponse.status === 401 || installationsResponse.status === 403) {
    return { connectionRequired: true as const, installationUrl: input.installationUrl, repositories: [] };
  }
  if (!installationsResponse.ok) {
    throw new Error(`GitHub installation discovery failed with ${installationsResponse.status}.`);
  }
  const body = await installationsResponse.json() as { installations?: Array<{ id?: unknown }> };
  const installationIds = (body.installations ?? []).flatMap(installation =>
    typeof installation.id === 'number' || typeof installation.id === 'string'
      ? [String(installation.id)]
      : [],
  );
  if (installationIds.length === 0) {
    return { connectionRequired: true as const, installationUrl: input.installationUrl, repositories: [] };
  }
  const repositorySets = await Promise.all(installationIds.map(async installationId => {
    const response = await fetcher(
      `https://api.github.com/user/installations/${encodeURIComponent(installationId)}/repositories?per_page=100`,
      { cache: 'no-store', headers: headers(input.accessToken) },
    );
    if (!response.ok) {
      throw new Error(`GitHub installation repository discovery failed with ${response.status}.`);
    }
    const repositoriesBody = await response.json() as {
      repositories?: Array<{
        default_branch?: unknown;
        full_name?: unknown;
        private?: unknown;
      }>;
    };
    return (repositoriesBody.repositories ?? []).flatMap(
      (repository): AtlasGitHubRepositoryChoice[] =>
        typeof repository.full_name === 'string' &&
        typeof repository.default_branch === 'string'
          ? [{
              defaultRef: repository.default_branch,
              fullName: repository.full_name,
              installationId,
              isPrivate: repository.private === true,
            }]
          : [],
    );
  }));
  const repositories = [...new Map(
    repositorySets.flat().map(repository => [repository.fullName.toLowerCase(), repository]),
  ).values()];
  return { connectionRequired: false as const, installationUrl: input.installationUrl, repositories };
};
