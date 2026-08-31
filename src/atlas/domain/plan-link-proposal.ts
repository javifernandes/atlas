import type { ParsedAtlasSource } from '../markdown/build-snapshot';

export type AtlasPlanLinkProposal = {
  after: string;
  before: string;
  itemSemanticId: string;
  patch: string;
  planPath: string;
  planReference: string;
  sourceId: string;
  sourcePath: string;
  status: 'already-linked' | 'proposed';
};

const splitLines = (content: string) => content.replaceAll('\r\n', '\n').split('\n');

const createUnifiedDiff = (sourcePath: string, before: string, after: string) => {
  if (before === after) {
    return '';
  }

  const beforeLines = splitLines(before);
  const afterLines = splitLines(after);
  let prefixLength = 0;

  while (
    prefixLength < beforeLines.length &&
    prefixLength < afterLines.length &&
    beforeLines[prefixLength] === afterLines[prefixLength]
  ) {
    prefixLength += 1;
  }

  let suffixLength = 0;
  while (
    suffixLength < beforeLines.length - prefixLength &&
    suffixLength < afterLines.length - prefixLength &&
    beforeLines[beforeLines.length - suffixLength - 1] ===
      afterLines[afterLines.length - suffixLength - 1]
  ) {
    suffixLength += 1;
  }

  const contextStart = Math.max(0, prefixLength - 3);
  const beforeChangeEnd = beforeLines.length - suffixLength;
  const afterChangeEnd = afterLines.length - suffixLength;
  const beforeHunkEnd = Math.min(beforeLines.length, beforeChangeEnd + 3);
  const afterHunkEnd = Math.min(afterLines.length, afterChangeEnd + 3);
  const contextBefore = beforeLines.slice(contextStart, prefixLength).map(line => ` ${line}`);
  const removed = beforeLines.slice(prefixLength, beforeChangeEnd).map(line => `-${line}`);
  const added = afterLines.slice(prefixLength, afterChangeEnd).map(line => `+${line}`);
  const contextAfter = beforeLines
    .slice(beforeChangeEnd, beforeHunkEnd)
    .map(line => ` ${line}`);

  return [
    `--- a/${sourcePath}`,
    `+++ b/${sourcePath}`,
    `@@ -${contextStart + 1},${beforeHunkEnd - contextStart} +${contextStart + 1},${afterHunkEnd - contextStart} @@`,
    ...contextBefore,
    ...removed,
    ...added,
    ...contextAfter,
  ].join('\n');
};

const insertRelatedPlan = (content: string, planReference: string) => {
  const newline = content.includes('\r\n') ? '\r\n' : '\n';
  const normalized = content.replaceAll('\r\n', '\n');
  const frontmatter = normalized.match(/^---\n([\s\S]*?)\n---(?:\n|$)/);

  if (!frontmatter?.[1]) {
    throw new Error('Atlas Item source must have frontmatter before proposing a Plan link.');
  }

  const lines = frontmatter[1].split('\n');
  const relatedPlansIndex = lines.findIndex(line => /^relatedPlans:\s*(?:\[\])?\s*$/.test(line));

  if (relatedPlansIndex === -1) {
    lines.push('relatedPlans:', `  - ${planReference}`);
  } else if (/^relatedPlans:\s*\[\]\s*$/.test(lines[relatedPlansIndex] ?? '')) {
    lines.splice(relatedPlansIndex, 1, 'relatedPlans:', `  - ${planReference}`);
  } else {
    let insertionIndex = relatedPlansIndex + 1;

    while (insertionIndex < lines.length && /^\s+-\s+/.test(lines[insertionIndex] ?? '')) {
      insertionIndex += 1;
    }

    lines.splice(insertionIndex, 0, `  - ${planReference}`);
  }

  const after = normalized.replace(frontmatter[1], lines.join('\n'));
  return newline === '\n' ? after : after.replaceAll('\n', '\r\n');
};

export const proposePlanLink = (
  source: ParsedAtlasSource,
  input: { itemSemanticId: string; planPath: string },
): AtlasPlanLinkProposal => {
  const item = source.items.find(candidate => candidate.id === input.itemSemanticId);
  const plan = source.plans.find(candidate => candidate.path === input.planPath);

  if (!item) {
    throw new Error(`Unknown Atlas Item ${input.itemSemanticId}.`);
  }

  if (!plan) {
    throw new Error(`Unknown Atlas Plan ${input.planPath}.`);
  }

  const sourceId = item.sourceId ?? 'atlas';
  const planReference = item.sourceId === plan.sourceId ? plan.sourcePath : plan.path;
  const alreadyLinked = item.relatedPlans.includes(plan.path);
  const before = item.markdown;
  const after = alreadyLinked ? before : insertRelatedPlan(before, planReference);

  return {
    after,
    before,
    itemSemanticId: item.id,
    patch: createUnifiedDiff(item.sourcePath, before, after),
    planPath: plan.path,
    planReference,
    sourceId,
    sourcePath: item.sourcePath,
    status: alreadyLinked ? 'already-linked' : 'proposed',
  };
};
