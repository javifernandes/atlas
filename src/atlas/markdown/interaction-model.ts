import type { InteractionItemModel } from '../model/item-kind';
import { parseActivityGraph } from './activity-graph';
import { markdownReference, sectionText, tableRows } from './entity-model';

const text = (value: string) => value.trim().replace(/^`([^`]*)`$/, '$1');
const label = (value: string) => {
  const normalized = text(value).replaceAll(/\\\|/g, '|');
  const wikiLink = normalized.match(/^\[\[([^\]|]+)(?:\|([^\]]+))?\]\]$/);

  if (wikiLink) return (wikiLink[2] ?? wikiLink[1] ?? '').trim();

  return normalized
    .replace(/^\[`([^`]*)`\]\([^)]+\)$/, '$1')
    .replace(/^\[([^\]]+)\]\([^)]+\)$/, '$1');
};
const labels = (value: string) =>
  text(value)
    .split(',')
    .map(item => label(item))
    .filter(Boolean);

export const parseInteractionModel = (
  markdown: string,
  scope: { entity?: unknown; binding?: unknown },
): InteractionItemModel => {
  const activity = parseActivityGraph(markdown);

  return {
    kind: 'interaction',
    ...(activity.graph ? { activity: activity.graph } : {}),
    scope: {
      entity: typeof scope.entity === 'string' ? scope.entity : '',
      binding: typeof scope.binding === 'string' ? scope.binding : '',
    },
    goal: sectionText(markdown, 'Goal').replaceAll(/\s+/g, ' ').trim(),
    actors: tableRows(markdown, 'Actors').map(row => ({
      actor: row.actor ?? '',
      participation: row.participation ?? '',
    })),
    context: tableRows(markdown, 'Context').map(row => row.requirement ?? ''),
    presents: tableRows(markdown, 'Presents', false).map(row => ({
      information: label(row.information ?? ''),
      source: label(row.source ?? ''),
      atStep: label(row.step ?? '') || undefined,
      reference: markdownReference(row.source ?? ''),
    })),
    affordances: tableRows(markdown, 'Affordances', false).map(row => ({
      label: label(row.affordance ?? ''),
      affordanceKind: text(row.kind ?? ''),
      atStep: label(row.step ?? '') || undefined,
      target: label(row.target ?? ''),
      reference: markdownReference(row.target ?? ''),
    })),
    steps: tableRows(markdown, 'Steps', false).map(row => {
      const actorAction = label(row['actor interaction'] ?? '');
      const externalSystems = label(row['external systems'] ?? '');
      const rules = label(row['rules and validation'] ?? '');
      const systemBehavior = label(row['system behavior'] ?? '');

      return {
        ...(actorAction ? { actorAction } : {}),
        ...(externalSystems ? { externalSystems } : {}),
        label: label(row.step ?? ''),
        stepKind: text(row.kind ?? ''),
        next: labels(row.next ?? ''),
        reference: markdownReference(row.target ?? ''),
        ...(rules ? { rules } : {}),
        ...(systemBehavior ? { systemBehavior } : {}),
      };
    }),
    outcomes: tableRows(markdown, 'Outcomes', false).map(row => ({
      outcome: label(row.outcome ?? ''),
      meaning: label(row.meaning ?? ''),
      fromStep: label(row.from ?? '') || undefined,
      continuesWith: markdownReference(row['continues with'] ?? ''),
    })),
  };
};
