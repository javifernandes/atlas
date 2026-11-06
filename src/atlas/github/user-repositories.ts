export const ATLAS_GITHUB_REPOSITORY_DISCOVERY_RESOURCE =
  'atlas.github.repository-discovery';

export type AtlasGitHubRepositoryChoice = {
  defaultRef: string;
  fullName: string;
  isPrivate: boolean;
};

export type AtlasGitHubRepositoryDiscovery = {
  installationFor(repositoryFullName: string): Promise<string | null>;
  installationUrl(): Promise<string | null>;
  list(): Promise<
    | { authorizationRequired: true; installationUrl: string | null; repositories: [] }
    | { authorizationRequired: false; installationUrl: string | null; repositories: AtlasGitHubRepositoryChoice[] }
  >;
};
