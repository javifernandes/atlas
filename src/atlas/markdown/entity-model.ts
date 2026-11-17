import type {
  EntityModel,
  EntityModelOperation,
  EntityOperationAvailability,
} from '../model/snapshot';

export const sectionText = (markdown: string, title: string) => {
  const escapedTitle = title.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = markdown.match(
    new RegExp(`(?:^|\\n)##\\s+${escapedTitle}\\s*\\n([\\s\\S]*?)(?=\\n##\\s+|$)`, 'i'),
  );

  return match?.[1]?.trim() ?? '';
};

const cleanCell = (value: string) =>
  value
    .trim()
    .replace(/^`([^`]*)`$/, '$1')
    .replace(/^\[`([^`]*)`\]\([^)]+\)$/, '$1')
    .replace(/^\[([^\]]+)\]\([^)]+\)$/, '$1')
    .replaceAll(/\\\|/g, '|');

export const markdownReference = (value: string) => {
  const markdownLink = value.trim().match(/^\[(?:`)?[^\]]+(?:`)?\]\(([^)]+)\)$/);
  if (markdownLink?.[1]) return markdownLink[1].trim();

  const wikiLink = value.trim().match(/^\[\[([^\]|]+)(?:\\?\|[^\]]+)?\]\]$/);
  return wikiLink?.[1]?.trim();
};

const splitRow = (line: string, clean = true) => {
  const cells: string[] = [];
  let current = '';
  let escaped = false;

  for (const character of line.trim().replace(/^\|/, '').replace(/\|$/, '')) {
    if (escaped) {
      current += character;
      escaped = false;
    } else if (character === '\\') {
      current += character;
      escaped = true;
    } else if (character === '|') {
      cells.push(clean ? cleanCell(current) : current.trim());
      current = '';
    } else {
      current += character;
    }
  }

  cells.push(clean ? cleanCell(current) : current.trim());
  return cells;
};

export const tableRows = (markdown: string, title: string, clean = true) => {
  const lines = sectionText(markdown, title)
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.startsWith('|'));

  if (lines.length < 2) return [];

  const headers = splitRow(lines[0]!).map(header => header.toLocaleLowerCase());
  const separator = splitRow(lines[1]!);

  if (!separator.every(cell => /^:?-{3,}:?$/.test(cell))) return [];

  return lines.slice(2).map(line => {
    const values = splitRow(line, clean);

    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));
  });
};

export const parseEntityModel = (markdown: string): EntityModel => ({
  fields: tableRows(markdown, 'Data').map(row => ({
    name: row.field ?? '',
    type: row.type ?? '',
    required: /^(yes|true|required)$/i.test(row.required ?? ''),
    meaning: row.meaning ?? '',
  })),
  relations: tableRows(markdown, 'Relations').map(row => ({
    name: row.relation ?? '',
    target: row.target ?? '',
    cardinality: row.cardinality ?? '',
    meaning: row.meaning ?? '',
  })),
  states: tableRows(markdown, 'States').map(row => ({
    name: row.state ?? '',
    kind: row.kind ?? '',
    meaning: row.meaning ?? '',
  })),
  operations: tableRows(markdown, 'Operations', false).map(row => ({
    name: cleanCell(row.operation ?? ''),
    reference: markdownReference(row.operation ?? ''),
    actor: cleanCell(row.actor ?? ''),
    appliesWhen: cleanCell(row['applies when'] ?? ''),
    transition: cleanCell(row.transition ?? ''),
    effects: cleanCell(row.effects ?? ''),
  })),
  invariants: tableRows(markdown, 'Invariants').map(row => ({
    rule: row.rule ?? '',
    constraint: row.constraint ?? '',
  })),
});

export const hasEntityBehavior = (model: EntityModel) =>
  model.states.length > 0 || model.operations.length > 0;

const operationSourceState = (operation: EntityModelOperation, states: string[]) => {
  const transitionSource = operation.transition.match(/^(.+?)\s*->\s*(.+)$/)?.[1]?.trim();
  if (transitionSource) {
    return /^none$/i.test(transitionSource) ? 'Before creation' : transitionSource;
  }

  return states.find(state =>
    new RegExp(
      `(^|[^\\p{L}\\p{N}])${state.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^\\p{L}\\p{N}])`,
      'iu',
    ).test(operation.appliesWhen),
  );
};

export const buildEntityOperationAvailability = (
  model: EntityModel,
): EntityOperationAvailability[] => {
  const stateNames = model.states.map(state => state.name);
  const operationsByState = new Map<string, EntityModelOperation[]>();

  for (const operation of model.operations) {
    const state =
      operationSourceState(operation, stateNames) ?? (operation.appliesWhen || 'Any state');
    operationsByState.set(state, [...(operationsByState.get(state) ?? []), operation]);
  }

  const rows: EntityOperationAvailability[] = [];
  const contextualStates = [...operationsByState.keys()].filter(
    state => !stateNames.includes(state),
  );
  const orderedStates = [
    ...contextualStates.filter(state => state === 'Before creation'),
    ...stateNames,
    ...contextualStates.filter(state => state !== 'Before creation'),
  ];

  for (const state of orderedStates) {
    const operations = operationsByState.get(state) ?? [];
    const actors = [...new Set(operations.map(operation => operation.actor || 'Any actor'))];

    if (actors.length === 0) {
      rows.push({ state, actor: '—', operations: [] });
      continue;
    }

    for (const actor of actors) {
      rows.push({
        state,
        actor,
        operations: operations.filter(operation => (operation.actor || 'Any actor') === actor),
      });
    }
  }

  return rows;
};

const mermaidIdentifier = (value: string) => {
  const identifier = value.replaceAll(/[^A-Za-z0-9_]/g, '_');

  return /^[A-Za-z_]/.test(identifier) ? identifier : `state_${identifier}`;
};

const mermaidLabel = (value: string) => value.replaceAll('"', "'").replaceAll('\n', ' ');

export const buildEntityStatechart = (model: EntityModel) => {
  if (model.states.length === 0) return null;

  const lines = ['stateDiagram-v2'];
  const stateIds = new Map(model.states.map(state => [state.name, mermaidIdentifier(state.name)]));

  for (const state of model.states) {
    lines.push(`  state "${mermaidLabel(state.name)}" as ${stateIds.get(state.name)}`);
  }

  for (const state of model.states.filter(state => state.kind === 'initial')) {
    lines.push(`  [*] --> ${stateIds.get(state.name)}`);
  }

  for (const operation of model.operations) {
    const transition = operation.transition.match(/^(.+?)\s*->\s*(.+)$/);

    if (!transition) continue;

    const from = transition[1]?.trim() ?? '';
    const to = transition[2]?.trim() ?? '';
    const fromId = /^none$/i.test(from) ? '[*]' : stateIds.get(from);
    const toId = /^none$/i.test(to) ? '[*]' : stateIds.get(to);

    if (!fromId || !toId) continue;

    lines.push(
      `  ${fromId} --> ${toId} : ${mermaidLabel(operation.name)} · ${mermaidLabel(operation.actor)}`,
    );
  }

  for (const state of model.states.filter(state => state.kind === 'terminal')) {
    lines.push(`  ${stateIds.get(state.name)} --> [*]`);
  }

  return lines.join('\n');
};
