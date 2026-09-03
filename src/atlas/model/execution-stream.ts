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
import { field, graphSchema } from '@ontahi/core/data-graph';
