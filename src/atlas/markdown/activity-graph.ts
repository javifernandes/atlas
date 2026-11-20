import { parseDocument } from 'yaml';

import {
  isActivityNodeKind,
  validateActivityGraph,
  type ActivityGraph,
  type ActivityGraphDiagnostic,
  type ActivityNode,
  type ActivityResponsibility,
  type ActivitySemanticReference,
  type ActivityTransition,
} from '../model/activity-graph';

type ActivityGraphParseDiagnosticCode =
  | ActivityGraphDiagnostic['code']
  | 'invalid-yaml'
  | 'invalid-activity-root'
  | 'invalid-node'
  | 'invalid-node-kind'
  | 'invalid-responsibility'
  | 'invalid-transition';

export type ActivityGraphParseDiagnostic = Omit<ActivityGraphDiagnostic, 'code'> & {
  code: ActivityGraphParseDiagnosticCode;
};

export type ActivityGraphParseResult = {
  graph?: ActivityGraph;
  diagnostics: ActivityGraphParseDiagnostic[];
};

const activityBlock = /```atlas-activity\s*\n([\s\S]*?)\n```/i;
const responsibilities = new Set<ActivityResponsibility>(['actor', 'system', 'external']);

const record = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

const nonEmptyString = (value: unknown) =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;

const reference = (value: unknown): ActivitySemanticReference | undefined => {
  const stringReference = nonEmptyString(value);
  if (stringReference) return { reference: stringReference };

  const objectReference = record(value);
  if (!objectReference) return undefined;

  const semanticReference = nonEmptyString(objectReference.ref ?? objectReference.reference);
  if (!semanticReference) return undefined;

  const label = nonEmptyString(objectReference.label);
  return { ...(label ? { label } : {}), reference: semanticReference };
};

const references = (value: unknown) =>
  Array.isArray(value)
    ? value.flatMap(candidate => {
        const parsed = reference(candidate);
        return parsed ? [parsed] : [];
      })
    : [];

const parseNode = (
  id: string,
  value: unknown,
  diagnostics: ActivityGraphParseDiagnostic[],
): ActivityNode | undefined => {
  const source = record(value);
  if (!source) {
    diagnostics.push({
      code: 'invalid-node',
      message: `Activity node ${id} must be a YAML mapping.`,
      path: `nodes.${id}`,
      severity: 'error',
    });
    return undefined;
  }

  const kind = nonEmptyString(source.kind);
  if (!kind || !isActivityNodeKind(kind)) {
    diagnostics.push({
      code: 'invalid-node-kind',
      message: `Activity node ${id} has unsupported kind ${kind ?? '(missing)'}.`,
      path: `nodes.${id}.kind`,
      severity: 'error',
    });
    return undefined;
  }

  const responsibility = nonEmptyString(source.responsibility);
  const parsedResponsibility =
    responsibility && responsibilities.has(responsibility as ActivityResponsibility)
      ? (responsibility as ActivityResponsibility)
      : undefined;
  if (responsibility && !parsedResponsibility) {
    diagnostics.push({
      code: 'invalid-responsibility',
      message: `Activity node ${id} has unsupported responsibility ${responsibility}.`,
      path: `nodes.${id}.responsibility`,
      severity: 'error',
    });
  }
  const semanticReference = reference(source.ref ?? source.reference);

  return {
    id,
    kind,
    label: nonEmptyString(source.label) ?? id,
    ...(nonEmptyString(source.actor) ? { actor: nonEmptyString(source.actor) } : {}),
    ...(parsedResponsibility ? { responsibility: parsedResponsibility } : {}),
    reads: references(source.reads),
    presents: references(source.presents),
    ...(semanticReference ? { reference: semanticReference } : {}),
  };
};

const parseTransition = (
  value: unknown,
  index: number,
  diagnostics: ActivityGraphParseDiagnostic[],
): ActivityTransition | undefined => {
  const source = record(value);
  const from = nonEmptyString(source?.from);
  const to = nonEmptyString(source?.to);

  if (!source || !from || !to) {
    diagnostics.push({
      code: 'invalid-transition',
      message: `Activity transition ${index} must declare non-empty from and to node IDs.`,
      path: `transitions.${index}`,
      severity: 'error',
    });
    return undefined;
  }

  return {
    from,
    to,
    ...(nonEmptyString(source.guard) ? { guard: nonEmptyString(source.guard) } : {}),
    ...(nonEmptyString(source.trigger) ? { trigger: nonEmptyString(source.trigger) } : {}),
    ...(nonEmptyString(source.affordance)
      ? { affordance: nonEmptyString(source.affordance) }
      : {}),
    ...(nonEmptyString(source.result) ? { result: nonEmptyString(source.result) } : {}),
  };
};

export const parseActivityGraph = (markdown: string): ActivityGraphParseResult => {
  const source = markdown.match(activityBlock)?.[1];
  if (source === undefined) return { diagnostics: [] };

  const document = parseDocument(source, { prettyErrors: true, uniqueKeys: true });
  if (document.errors.length > 0) {
    return {
      diagnostics: document.errors.map(error => ({
        code: 'invalid-yaml',
        message: error.message,
        severity: 'error',
      })),
    };
  }

  const root = record(document.toJS());
  const activity = record(root?.activity);
  const nodeSources = record(activity?.nodes);
  const transitionSources = activity?.transitions;

  if (!activity || !nodeSources || !Array.isArray(transitionSources)) {
    return {
      diagnostics: [
        {
          code: 'invalid-activity-root',
          message: 'atlas-activity must contain activity.entry, activity.nodes, and activity.transitions.',
          path: 'activity',
          severity: 'error',
        },
      ],
    };
  }

  const diagnostics: ActivityGraphParseDiagnostic[] = [];
  const nodes = Object.entries(nodeSources).flatMap(([id, value]) => {
    const node = parseNode(id, value, diagnostics);
    return node ? [node] : [];
  });
  const transitions = transitionSources.flatMap((value, index) => {
    const transition = parseTransition(value, index, diagnostics);
    return transition ? [transition] : [];
  });
  const graph: ActivityGraph = {
    entry: nonEmptyString(activity.entry) ?? '',
    nodes,
    transitions,
  };

  return { graph, diagnostics: [...diagnostics, ...validateActivityGraph(graph)] };
};
