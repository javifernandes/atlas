import type { InteractionItemModel } from '../model/item-kind';
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

export const parseInteractionModel = (
  markdown: string,
  scope: { entity?: unknown; binding?: unknown },
): InteractionItemModel => ({
  kind: 'interaction',
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
    reference: markdownReference(row.source ?? ''),
  })),
  affordances: tableRows(markdown, 'Affordances', false).map(row => ({
    label: label(row.affordance ?? ''),
    affordanceKind: text(row.kind ?? ''),
    reference: markdownReference(row.target ?? ''),
  })),
  steps: tableRows(markdown, 'Steps', false).map(row => ({
    label: label(row.step ?? ''),
    stepKind: text(row.kind ?? ''),
    reference: markdownReference(row.target ?? ''),
  })),
  outcomes: tableRows(markdown, 'Outcomes', false).map(row => ({
    outcome: label(row.outcome ?? ''),
    meaning: label(row.meaning ?? ''),
    continuesWith: markdownReference(row['continues with'] ?? ''),
  })),
});
