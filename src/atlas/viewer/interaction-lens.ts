import type { InteractionItemModel } from '../model/item-kind';

export type InteractionLensStep = InteractionItemModel['steps'][number] & {
  affordances: InteractionItemModel['affordances'];
  outcomes: InteractionItemModel['outcomes'];
  presents: InteractionItemModel['presents'];
};

export type InteractionLensMoment = {
  id: string;
  steps: InteractionLensStep[];
};

export type InteractionLensProjection = {
  moments: InteractionLensMoment[];
  unboundOutcomes: InteractionItemModel['outcomes'];
};

const slug = (value: string) =>
  value
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/^-|-$/g, '');

export const buildInteractionLensProjection = (
  model: InteractionItemModel,
): InteractionLensProjection => {
  const stepsByLabel = new Map(model.steps.map(step => [step.label, step]));
  const incoming = new Set(model.steps.flatMap(step => step.next));
  const roots = model.steps.filter(step => !incoming.has(step.label));
  const levels = new Map<string, number>();
  const queue = (roots.length > 0 ? roots : model.steps.slice(0, 1)).map(step => ({
    label: step.label,
    level: 0,
  }));

  while (queue.length > 0) {
    const entry = queue.shift();
    if (!entry) break;

    const previousLevel = levels.get(entry.label);
    if (previousLevel !== undefined && previousLevel >= entry.level) continue;

    levels.set(entry.label, entry.level);
    const step = stepsByLabel.get(entry.label);
    step?.next.forEach(label => {
      if (stepsByLabel.has(label)) queue.push({ label, level: entry.level + 1 });
    });
  }

  model.steps.forEach(step => {
    if (!levels.has(step.label)) levels.set(step.label, 0);
  });

  const steps = model.steps.map<InteractionLensStep>(step => ({
    ...step,
    affordances: model.affordances.filter(item => item.atStep === step.label),
    outcomes: model.outcomes.filter(item => item.fromStep === step.label),
    presents: model.presents.filter(item => item.atStep === step.label),
  }));
  const maximumLevel = Math.max(0, ...levels.values());
  const moments = Array.from({ length: maximumLevel + 1 }, (_, level) => {
    const momentSteps = steps.filter(step => levels.get(step.label) === level);
    return {
      id: momentSteps.length === 1 ? slug(momentSteps[0]?.label ?? `${level}`) : `branch-${level}`,
      steps: momentSteps,
    };
  }).filter(moment => moment.steps.length > 0);

  return {
    moments,
    unboundOutcomes: model.outcomes.filter(item => !item.fromStep),
  };
};
