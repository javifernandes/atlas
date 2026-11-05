export const ATLAS_GITHUB_REPOSITORY_DISCOVERY_RESOURCE =
  'atlas.github.repository-discovery';

export type AtlasGitHubRepositoryChoice = {
  defaultRef: string;
  fullName: string;
  isPrivate: boolean;
};

export type AtlasGitHubRepositoryDiscovery = {
  list(): Promise<
    | { authorizationRequired: true; repositories: [] }
    | { authorizationRequired: false; repositories: AtlasGitHubRepositoryChoice[] }
  >;
};
