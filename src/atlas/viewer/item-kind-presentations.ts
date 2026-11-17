import type { PlanNodeKind } from '../model/snapshot';

export type ItemKindVisualRole = 'container' | 'shape' | 'supporting' | 'temporal';
export type ItemKindEvolution = 'descendant-plans' | 'self';

export type ItemKindPresentation = {
  detail?: {
    overview?: 'package-details';
    sections?: Record<string, 'entity-behavior'>;
  };
  evolution: ItemKindEvolution;
  visualRole: ItemKindVisualRole;
};

const presentationOverrides: Partial<Record<PlanNodeKind, Partial<ItemKindPresentation>>> = {
  candidate: { visualRole: 'temporal' },
  entity: { detail: { sections: { states: 'entity-behavior' } } },
  model: { visualRole: 'container' },
  package: {
    detail: { overview: 'package-details' },
    evolution: 'descendant-plans',
    visualRole: 'container',
  },
  plan: { visualRole: 'temporal' },
  project: { visualRole: 'container' },
  root: { visualRole: 'container' },
  territory: { visualRole: 'container' },
  workstream: { visualRole: 'supporting' },
  artifact: { visualRole: 'supporting' },
  concept: { visualRole: 'supporting' },
  evidence: { visualRole: 'supporting' },
  policy: { visualRole: 'supporting' },
  practice: { visualRole: 'supporting' },
  principle: { visualRole: 'supporting' },
  relation: { visualRole: 'supporting' },
  state: { visualRole: 'supporting' },
  'system-primitive': { visualRole: 'supporting' },
  tooling: { visualRole: 'supporting' },
};

export const getItemKindPresentation = (kind: PlanNodeKind): ItemKindPresentation => ({
  detail: presentationOverrides[kind]?.detail,
  evolution: presentationOverrides[kind]?.evolution ?? 'self',
  visualRole: presentationOverrides[kind]?.visualRole ?? 'shape',
});

export const getItemKindSectionPresentation = (kind: PlanNodeKind, heading: string) =>
  getItemKindPresentation(kind).detail?.sections?.[heading.toLowerCase()];
