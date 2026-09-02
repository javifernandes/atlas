export const parseGitHubRepositoryName = (repository: string): string | null => {
  const value = repository.trim();
  const shorthand = value.match(/^([^/:\s]+)\/([^/\s]+?)(?:\.git)?$/);

  if (shorthand?.[1] && shorthand[2]) {
    return `${shorthand[1]}/${shorthand[2]}`;
  }

  const https = value.match(
    /^(?:git\+)?https:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/i,
  );

  if (https?.[1] && https[2]) {
    return `${https[1]}/${https[2]}`;
  }

  const ssh = value.match(/^git@github\.com:([^/]+)\/(.+?)(?:\.git)?$/i);

  return ssh?.[1] && ssh[2] ? `${ssh[1]}/${ssh[2]}` : null;
};

export const githubRepositoryCacheTag = (repositoryFullName: string) =>
  `atlas:github:${repositoryFullName.toLowerCase()}`;
