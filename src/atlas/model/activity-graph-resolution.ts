import type {
  ActivityGraph,
  ActivityGraphDiagnostic,
  ActivitySemanticReference,
} from './activity-graph';

export type ActivityReferenceResolution = {
  targetNodeId?: string;
};

export type ActivityReferenceResolver = (
  reference: ActivitySemanticReference,
) => ActivityReferenceResolution | undefined;

export type ResolvedActivityGraph = {
  diagnostics: ActivityGraphDiagnostic[];
  graph: ActivityGraph;
};

export const resolveActivityGraphReferences = (
  graph: ActivityGraph,
  resolve: ActivityReferenceResolver,
): ResolvedActivityGraph => {
  const diagnostics: ActivityGraphDiagnostic[] = [];

  const resolveReference = (
    reference: ActivitySemanticReference,
    path: string,
  ): ActivitySemanticReference => {
    const target = resolve(reference);
    const resolved = Boolean(target?.targetNodeId);

    if (!resolved) {
      diagnostics.push({
        code: 'unresolved-semantic-reference',
        message: `Activity reference ${reference.reference} does not identify an authored Atlas Item.`,
        path,
        severity: 'warning',
      });
    }

    return {
      ...reference,
      resolution: resolved ? 'resolved' : 'unresolved',
      ...(target?.targetNodeId ? { targetNodeId: target.targetNodeId } : {}),
    };
  };

  return {
    diagnostics,
    graph: {
      ...graph,
      actors: graph.actors.map(actor => ({
        ...actor,
        context: actor.context.map((reference, index) =>
          resolveReference(reference, `actors.${actor.id}.context.${index}`),
        ),
      })),
      nodes: graph.nodes.map(node => ({
        ...node,
        reads: node.reads.map((reference, index) =>
          resolveReference(reference, `nodes.${node.id}.reads.${index}`),
        ),
        presents: node.presents.map((reference, index) =>
          resolveReference(reference, `nodes.${node.id}.presents.${index}`),
        ),
        ...(node.reference
          ? { reference: resolveReference(node.reference, `nodes.${node.id}.ref`) }
          : {}),
      })),
    },
  };
};
