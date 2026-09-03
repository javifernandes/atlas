export type AtlasExecutionStreamPlan = {
  id: string;
  path: string;
  status: string;
  title: string;
};

export type AtlasExecutionStreamPullRequest = {
  authorLogin: string | null;
  mergedAt: string;
  number: number;
  repositoryFullName: string;
  title: string;
  url: string;
};

export type AtlasExecutionStreamActivityProjection = {
  id: string;
  attribution: 'implicit-single-open';
  kind: 'pull-request-merged';
  occurredAt: string;
  plan: AtlasExecutionStreamPlan | null;
  pullRequest: AtlasExecutionStreamPullRequest | null;
};

export type AtlasExecutionStreamProjection = {
  id: string;
  activities: AtlasExecutionStreamActivityProjection[];
  closedAt: string | null;
  currentFocusPlan: AtlasExecutionStreamPlan | null;
  mode: 'implicit' | 'explicit';
  openedAt: string;
  roots: AtlasExecutionStreamPlan[];
  status: 'open' | 'closed';
  title: string;
  updatedAt: string;
};

export type AtlasExecutionStreamCloseResult = {
  id: string;
  closed: boolean;
  closedAt: string | null;
};
