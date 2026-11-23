import type { OperationInvariantReference, OperationItemModel } from '../model/item-kind';
import { sectionText } from './entity-model';

const plainOperationText = (value: string) =>
  value
    .replaceAll(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
    .replaceAll(/\[\[([^\]]+)\]\]/g, '$1')
    .replaceAll(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replaceAll(/`([^`]+)`/g, '$1')
    .replaceAll(/\s+/g, ' ')
    .trim();

const operationList = (body: string, title: string) =>
  sectionText(body, title)
    .split('\n')
    .map(line => line.trim().replace(/^[-*]\s+/, ''))
    .filter(Boolean)
    .map(plainOperationText);

const invariantReferences = (body: string, ownerReference?: string): OperationInvariantReference[] => {
  const authored = sectionText(body, 'Invariants Preserved');
  const inlineRules = [...authored.matchAll(/`([^`]+)`/g)]
    .map(match => match[1]?.trim())
    .filter((rule): rule is string => Boolean(rule));
  const rules = inlineRules.length > 0
    ? inlineRules
    : authored
        .split('\n')
        .map(line => plainOperationText(line.trim().replace(/^[-*]\s+/, '')))
        .filter(Boolean);

  return [...new Set(rules)].map(rule => ({
    ownerReference,
    reference: ownerReference ? `${ownerReference}#invariant:${rule}` : undefined,
    rule,
  }));
};

export const parseOperationModel = (
  body: string,
  realizationRefs: OperationItemModel['realizationRefs'] = [],
  invariantOwnerReference?: string,
): OperationItemModel => ({
  actor: plainOperationText(sectionText(body, 'Actor')),
  availability: plainOperationText(sectionText(body, 'Availability')),
  failures: operationList(body, 'Failures'),
  inputsAndOutput: plainOperationText(sectionText(body, 'Inputs And Output')),
  invariantsPreserved: invariantReferences(body, invariantOwnerReference),
  kind: 'operation',
  realizationRefs,
  receiver: plainOperationText(sectionText(body, 'Receiver')),
  transitionAndEffects: plainOperationText(sectionText(body, 'Transition And Effects')),
});

const withoutTerminalPeriod = (value: string) => value.replace(/\.$/, '');

const splitInputsAndOutput = (value: string) => {
  const match = value.match(/^(.*?)(?:\s+The result is\s+)(.*)$/i);
  return match
    ? { inputs: match[1]?.trim(), output: match[2]?.trim() }
    : { inputs: value, output: '' };
};

const compactInput = (value: string) =>
  value.replace(/^(?:inputs?|arguments?)\s+(?:are|is)\s+/i, '').trim();

const splitTransitionAndEffects = (value: string) => {
  const match = value.match(/^([^.]*(?:->)[^.]*)\.\s*(.*)$/);
  return match
    ? { effects: match[2]?.trim(), transition: match[1]?.trim() }
    : { effects: value, transition: '' };
};

const quoted = (value: string) => JSON.stringify(withoutTerminalPeriod(value));

export type OperationPseudocodeLine = {
  indent: number;
  keyword?: string;
  value?: string;
  valueKind?: 'declaration' | 'failure' | 'invariant' | 'string' | 'transition';
  invariantReference?: OperationInvariantReference;
};

export const buildOperationPseudocodeLines = (
  title: string,
  model: OperationItemModel,
): OperationPseudocodeLine[] => {
  const lines: OperationPseudocodeLine[] = [{
    indent: 0,
    keyword: 'operation',
    value: title,
    valueKind: 'declaration',
  }];
  if (model.receiver) {
    lines.push({ indent: 1, keyword: 'on', value: quoted(model.receiver), valueKind: 'string' });
  }
  if (model.actor) {
    lines.push({ indent: 1, keyword: 'by', value: quoted(model.actor), valueKind: 'string' });
  }

  const { inputs, output } = splitInputsAndOutput(model.inputsAndOutput ?? '');
  if (inputs) {
    lines.push(
      { indent: 0 },
      { indent: 1, keyword: 'input', value: quoted(compactInput(inputs)), valueKind: 'string' },
    );
  }
  if (output) {
    lines.push({ indent: 1, keyword: 'returns', value: quoted(output), valueKind: 'string' });
  }
  if (model.availability) {
    lines.push(
      { indent: 0 },
      { indent: 1, keyword: 'requires', value: quoted(model.availability), valueKind: 'string' },
    );
  }

  const { effects, transition } = splitTransitionAndEffects(model.transitionAndEffects ?? '');
  if (transition) {
    lines.push(
      { indent: 0 },
      { indent: 1, keyword: 'transitions', value: transition, valueKind: 'transition' },
    );
  }
  if (effects) {
    lines.push({ indent: 1, keyword: 'effects', value: quoted(effects), valueKind: 'string' });
  }

  if ((model.failures?.length ?? 0) > 0) {
    lines.push(
      { indent: 0 },
      { indent: 1, keyword: 'fails with' },
      ...(model.failures ?? []).map(failure => ({
        indent: 2,
        value: failure,
        valueKind: 'failure' as const,
      })),
    );
  }
  if ((model.invariantsPreserved?.length ?? 0) > 0) {
    lines.push(
      { indent: 0 },
      { indent: 1, keyword: 'preserves' },
      ...(model.invariantsPreserved ?? []).map(invariant => ({
        indent: 2,
        invariantReference: invariant,
        value: invariant.rule,
        valueKind: 'invariant' as const,
      })),
    );
  }

  return lines;
};

export const buildOperationPseudocode = (title: string, model: OperationItemModel) =>
  buildOperationPseudocodeLines(title, model)
    .map(line => `${'  '.repeat(line.indent)}${line.keyword ?? ''}${line.keyword && line.value ? ' ' : ''}${line.value ?? ''}`)
    .join('\n');
