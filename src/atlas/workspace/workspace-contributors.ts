export type WorkspaceSourceForParticipation = {
  id: string;
  sourceId: string;
  workspaceId: string;
};

export type PullRequestForParticipation = {
  authorAvatarUrl: string | null;
  authorLogin: string | null;
  authorProviderAccountId: string | null;
  mergedAt: string;
  sourceId: string;
};

export type WorkspaceContributorProjection = {
  id: string;
  workspaceId: string;
  workspaceSourceId: string;
  sourceId: string;
  provider: 'github';
  providerAccountId: string;
  login: string;
  avatarUrl: string | null;
  kind: 'person' | 'bot';
  contributionCount: number;
  lastContributedAt: string;
  linkedUserId: string | null;
};

const contributorKey = (sourceId: string, providerAccountId: string) =>
  `${sourceId}\0${providerAccountId}`;

const isBotLogin = (login: string) => /(?:\[bot\]|-bot)$/i.test(login);

export const deriveWorkspaceContributors = (input: {
  linkedUserIdByGithubAccountId?: ReadonlyMap<string, string>;
  pullRequests: PullRequestForParticipation[];
  sources: WorkspaceSourceForParticipation[];
}): WorkspaceContributorProjection[] => {
  const sourcesBySourceId = new Map<string, WorkspaceSourceForParticipation[]>();
  for (const source of input.sources) {
    const sources = sourcesBySourceId.get(source.sourceId) ?? [];
    sources.push(source);
    sourcesBySourceId.set(source.sourceId, sources);
  }

  const participation = new Map<
    string,
    PullRequestForParticipation & { contributionCount: number; providerAccountId: string; login: string }
  >();

  for (const pullRequest of input.pullRequests) {
    if (!pullRequest.authorProviderAccountId || !pullRequest.authorLogin) continue;

    const key = contributorKey(pullRequest.sourceId, pullRequest.authorProviderAccountId);
    const current = participation.get(key);
    if (!current) {
      participation.set(key, {
        ...pullRequest,
        contributionCount: 1,
        providerAccountId: pullRequest.authorProviderAccountId,
        login: pullRequest.authorLogin,
      });
      continue;
    }

    current.contributionCount += 1;
    if (pullRequest.mergedAt > current.mergedAt) {
      current.mergedAt = pullRequest.mergedAt;
      current.authorLogin = pullRequest.authorLogin;
      current.login = pullRequest.authorLogin;
      current.authorAvatarUrl = pullRequest.authorAvatarUrl;
    }
  }

  return [...participation.values()]
    .flatMap(participant =>
      (sourcesBySourceId.get(participant.sourceId) ?? []).map(source => ({
        id: `${source.workspaceId}:${source.sourceId}:github:${participant.providerAccountId}`,
        workspaceId: source.workspaceId,
        workspaceSourceId: source.id,
        sourceId: source.sourceId,
        provider: 'github' as const,
        providerAccountId: participant.providerAccountId,
        login: participant.login,
        avatarUrl: participant.authorAvatarUrl,
        kind: isBotLogin(participant.login) ? ('bot' as const) : ('person' as const),
        contributionCount: participant.contributionCount,
        lastContributedAt: participant.mergedAt,
        linkedUserId:
          input.linkedUserIdByGithubAccountId?.get(participant.providerAccountId) ?? null,
      })),
    )
    .sort(
      (left, right) =>
        right.lastContributedAt.localeCompare(left.lastContributedAt) ||
        left.login.localeCompare(right.login),
    );
};
