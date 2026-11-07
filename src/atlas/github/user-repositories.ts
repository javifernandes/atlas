export const ATLAS_GITHUB_REPOSITORY_DISCOVERY_RESOURCE =
  'atlas.github.repository-discovery';

export type AtlasGitHubRepositoryChoice = {
  defaultRef: string;
  fullName: string;
  installationId: string;
  isPrivate: boolean;
};

export type AtlasGitHubRepositoryDiscovery = {
  installationUrl(): Promise<string | null>;
  list(): Promise<
    | { connectionRequired: true; installationUrl: string | null; repositories: [] }
    | { connectionRequired: false; installationUrl: string | null; repositories: AtlasGitHubRepositoryChoice[] }
  >;
};
