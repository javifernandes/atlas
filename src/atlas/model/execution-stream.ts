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
  attribution: 'explicit-directive' | 'implicit-single-open';
  kind: 'pull-request-merged';
  occurredAt: string;
  plan: AtlasExecutionStreamPlan | null;
  pullRequest: AtlasExecutionStreamPullRequest | null;
};

export type AtlasExecutionStreamProjection = {
  id: string;
  activities: AtlasExecutionStreamActivityProjection[];
  archivedAt: string | null;
  closedAt: string | null;
  currentFocusPlan: AtlasExecutionStreamPlan | null;
  forkedFromStream: {
    id: string;
    title: string;
  } | null;
  mode: 'implicit' | 'explicit';
  lastActivityAt: string | null;
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

export type AtlasExecutionStreamForkResult = {
  forkedFromStreamId: string;
  id: string;
  rootPlanIds: string[];
  title: string;
};

export type AtlasExecutionStreamSetArchivedResult = {
  archived: boolean;
  archivedAt: string | null;
  id: string;
};

export type AtlasSessionDirectiveParseResult =
  | { kind: 'absent' }
  | { kind: 'invalid'; reason: 'duplicate' | 'malformed' }
  | { kind: 'valid'; sessionId: string };

export const buildAtlasSessionInstructions = (input: {
  id: string;
  title: string;
  url?: string;
}) =>
  [
    `Atlas Session: ${input.title}`,
    `Session ID: ${input.id}`,
    ...(input.url ? [`Session URL: ${input.url}`] : []),
    '',
    'For every PR created for this work, keep this line in the PR body:',
    `Atlas-Session: ${input.id}`,
  ].join('\n');

type ExecutionStreamPlanNode = {
  id: string;
  parentPlanId: string | null;
  title: string;
};

type ExecutionStreamPlanBinding = {
  kind: 'implements' | 'shapes';
  planId: string | null;
  pullRequestId: string;
};

const canonicalUuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const parseAtlasSessionDirective = (
  body: string | null | undefined,
): AtlasSessionDirectiveParseResult => {
  const lines = body?.split(/\r?\n/) ?? [];
  const directiveLines = lines.filter(line => /^\s*atlas-session\b/i.test(line));

  if (directiveLines.length === 0) {
    return { kind: 'absent' };
  }

  if (directiveLines.length > 1) {
    return { kind: 'invalid', reason: 'duplicate' };
  }

  const match = directiveLines[0]?.match(/^\s*atlas-session\s*:\s*(\S+)\s*$/i);
  const sessionId = match?.[1];

  return sessionId && canonicalUuidPattern.test(sessionId)
    ? { kind: 'valid', sessionId: sessionId.toLowerCase() }
    : { kind: 'invalid', reason: 'malformed' };
};

type ExecutionStreamRoutingCandidate = {
  id: string;
  mode: 'explicit' | 'implicit';
  status: 'closed' | 'open';
  userId: string;
};

export const resolveExecutionStreamActivityTarget = <
  TStream extends ExecutionStreamRoutingCandidate,
>(input: {
  directive: AtlasSessionDirectiveParseResult;
  streams: readonly TStream[];
  userId: string;
}):
  | { kind: 'create-implicit' }
  | {
      attribution: 'explicit-directive' | 'implicit-single-open';
      kind: 'existing';
      stream: TStream;
    }
  | { kind: 'unrouted' } => {
  if (input.directive.kind === 'invalid') {
    return { kind: 'unrouted' };
  }

  if (input.directive.kind === 'valid') {
    const sessionId = input.directive.sessionId;
    const stream = input.streams.find(
      candidate =>
        candidate.id === sessionId &&
        candidate.userId === input.userId &&
        candidate.status === 'open',
    );

    return stream
      ? { attribution: 'explicit-directive', kind: 'existing', stream }
      : { kind: 'unrouted' };
  }

  const implicitStream = input.streams.find(
    candidate =>
      candidate.userId === input.userId &&
      candidate.mode === 'implicit' &&
      candidate.status === 'open',
  );

  return implicitStream
    ? {
        attribution: 'implicit-single-open',
        kind: 'existing',
        stream: implicitStream,
      }
    : { kind: 'create-implicit' };
};

export const resolveExecutionStreamForkPlans = <TPlan extends ExecutionStreamPlanNode>(input: {
  plans: readonly TPlan[];
  selectedPlanIds: readonly string[];
  sourceRootPlanIds: readonly string[];
}): [TPlan, ...TPlan[]] | null => {
  const plansById = new Map(input.plans.map(plan => [plan.id, plan] as const));
  const sourceRootPlanIds = new Set(input.sourceRootPlanIds);
  const selectedPlanIds = [...new Set(input.selectedPlanIds)];

  if (selectedPlanIds.length === 0 || sourceRootPlanIds.size === 0) {
    return null;
  }

  const selectedPlans = selectedPlanIds.flatMap(planId => {
    const plan = plansById.get(planId);

    if (!plan) {
      return [];
    }

    let current: TPlan | undefined = plan;
    const visited = new Set<string>();

    while (current && !visited.has(current.id)) {
      if (sourceRootPlanIds.has(current.id)) {
        return [plan];
      }

      visited.add(current.id);
      current = current.parentPlanId ? plansById.get(current.parentPlanId) : undefined;
    }

    return [];
  });

  const [firstPlan, ...additionalPlans] = selectedPlans;

  return firstPlan && selectedPlans.length === selectedPlanIds.length
    ? [firstPlan, ...additionalPlans]
    : null;
};

export const resolveExecutionStreamPlanContext = <TPlan extends ExecutionStreamPlanNode>(input: {
  bindings: readonly ExecutionStreamPlanBinding[];
  plans: readonly TPlan[];
  pullRequestId: string;
}): { focusPlan: TPlan; rootPlans: [TPlan, ...TPlan[]] } | null => {
  const plansById = new Map(input.plans.map(plan => [plan.id, plan] as const));
  const resolvedBindings = input.bindings.flatMap(binding => {
    if (binding.pullRequestId !== input.pullRequestId || !binding.planId) {
      return [];
    }

    const plan = plansById.get(binding.planId);

    return plan ? [{ binding, plan }] : [];
  });
  const focusPlan =
    resolvedBindings.find(candidate => candidate.binding.kind === 'implements')?.plan ??
    resolvedBindings[0]?.plan;

  if (!focusPlan) {
    return null;
  }

  const rootsById = new Map<string, TPlan>();
  const contextualPlans = [
    focusPlan,
    ...resolvedBindings.flatMap(({ plan }) => (plan.id === focusPlan.id ? [] : [plan])),
  ];

  for (const plan of contextualPlans) {
    const visited = new Set<string>();
    let rootPlan = plan;

    while (rootPlan.parentPlanId && !visited.has(rootPlan.id)) {
      visited.add(rootPlan.id);
      const parent = plansById.get(rootPlan.parentPlanId);

      if (!parent) {
        break;
      }

      rootPlan = parent;
    }

    rootsById.set(rootPlan.id, rootPlan);
  }

  const [focusRootPlan, ...additionalRootPlans] = [...rootsById.values()];

  return focusRootPlan
    ? { focusPlan, rootPlans: [focusRootPlan, ...additionalRootPlans] }
    : null;
};

export const AtlasExecutionStreamCloseInputSchema = graphSchema.object({
  id: field.id(),
});

export const AtlasExecutionStreamCloseOutputSchema = graphSchema.value(
  'CloseExecutionStreamResult',
  {
    id: field.id(),
    closed: field.boolean(),
    closedAt: graphSchema.nullable(field.string()),
  },
);

export const AtlasExecutionStreamForkInputSchema = graphSchema.object({
  sourceStreamId: field.id(),
  title: field.nonEmptyString({ trim: true }),
  planIds: graphSchema.array(field.id()),
});

export const AtlasExecutionStreamForkOutputSchema = graphSchema.value(
  'ForkExecutionStreamResult',
  {
    forkedFromStreamId: field.id(),
    id: field.id(),
    rootPlanIds: graphSchema.array(field.id()),
    title: field.nonEmptyString({ trim: true }),
  },
);

export const AtlasExecutionStreamSetArchivedInputSchema = graphSchema.object({
  id: field.id(),
  archived: field.boolean(),
});

export const AtlasExecutionStreamSetArchivedOutputSchema = graphSchema.value(
  'SetExecutionStreamArchivedResult',
  {
    id: field.id(),
    archived: field.boolean(),
    archivedAt: graphSchema.nullable(field.string()),
  },
);
import { field, graphSchema } from '@ontahi/core/data-graph';
