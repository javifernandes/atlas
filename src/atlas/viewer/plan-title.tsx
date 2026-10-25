import type { PlanWorkstreamNode } from '@/atlas/model/snapshot';
import { cn } from '@/lib/classes';

type PlanTitleProps = {
  className?: string;
  keyClassName?: string;
  node: PlanWorkstreamNode;
  titleClassName?: string;
};

type PlanIdBadgeProps = {
  className?: string;
  node: PlanWorkstreamNode;
};

export const getPlanDisplayKey = (node: PlanWorkstreamNode) => {
  if (node.kind !== 'plan') return null;

  const key =
    node.planKey ??
    (node.path ?? node.semanticId ?? '').match(/(?:^|\/)(\d+[a-z]*)[-–]/i)?.[1] ??
    null;

  return key && /^\d+[a-z]?$/i.test(key) ? key : null;
};

const planSourcePrefixes: Record<string, string> = {
  atlas: 'ATL',
  bookops: 'BOK',
  ontahi: 'ONT',
};

const getPlanSourceId = (node: PlanWorkstreamNode) =>
  node.sourceId ??
  (node.path ?? node.semanticId ?? node.id.replace(/^plan:/, '')).match(
    /^([a-z][a-z0-9+.-]*):\/\//i,
  )?.[1] ??
  'atlas';

export const getPlanDisplayId = (node: PlanWorkstreamNode) => {
  const key = getPlanDisplayKey(node);
  if (!key) return null;

  const sourceId = getPlanSourceId(node).toLowerCase();
  const prefix =
    planSourcePrefixes[sourceId] ?? sourceId.replace(/[^a-z0-9]/g, '').slice(0, 3).toUpperCase();

  return prefix ? `${prefix}-${key.toUpperCase()}` : key.toUpperCase();
};

export const PlanIdBadge = ({ className, node }: PlanIdBadgeProps) => {
  const planId = getPlanDisplayId(node);
  if (!planId) return null;

  return (
    <span
      aria-label={`Plan ${planId}`}
      className={cn(
        'shrink-0 rounded-md border border-sky-400/30 bg-sky-400/10 px-1.5 py-0.5 font-mono text-[0.78em] font-semibold leading-none tracking-tight text-sky-300',
        className,
      )}
    >
      {planId}
    </span>
  );
};

export const PlanTitle = ({ className, keyClassName, node, titleClassName }: PlanTitleProps) => {
  return (
    <span className={cn('inline-flex min-w-0 items-baseline gap-2', className)}>
      <PlanIdBadge className={keyClassName} node={node} />
      <span className={cn('min-w-0', titleClassName)}>{node.shortTitle}</span>
    </span>
  );
};
