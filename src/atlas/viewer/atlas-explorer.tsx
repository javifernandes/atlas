'use client';

import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  Columns3,
  Crosshair,
  ExternalLink,
  GitPullRequest,
  Info,
  Minus,
  Moon,
  Network,
  Plus,
  RotateCcw,
  Search,
  Sun,
  Undo2,
  X,
} from 'lucide-react';
import {
  Fragment,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { MermaidDiagram } from '@/components/mermaid-diagram';
import { useTheme } from '@/components/theme-provider';
import type {
  PlanRelationKind,
  PlanStatusGroup,
  PlanWorkstreamEdge,
  PlanWorkstreamEvidence,
  PlanWorkstreamNode,
  PlanWorkstreamSnapshot,
} from '@/atlas/model/snapshot';
import { cn } from '@/lib/classes';

type PlanWorkstreamExplorerProps = {
  snapshot: PlanWorkstreamSnapshot;
};

type FullMarkdownModalTab = 'context' | 'evolution' | 'overview' | 'source';

const defaultFullMarkdownModalTab: FullMarkdownModalTab = 'overview';

type PositionedNode = PlanWorkstreamNode & {
  x: number;
  y: number;
  width: number;
  height: number;
};

type Viewport = {
  x: number;
  y: number;
  scale: number;
};

type PointerPoint = {
  clientX: number;
  clientY: number;
};

type GestureState =
  | {
      mode: 'pan';
      hasMoved: boolean;
      pointerId: number;
      startClientX: number;
      startClientY: number;
      startCollapseToggle: boolean;
      startCollapseToggleNodeId: string | null;
      startNodeId: string | null;
      startX: number;
      startY: number;
    }
  | {
      mode: 'pinch';
      startCenterX: number;
      startCenterY: number;
      startDistance: number;
      startScale: number;
      startX: number;
      startY: number;
    };

type NativeGestureEvent = Event & {
  clientX?: number;
  clientY?: number;
  scale?: number;
};

type NativeWheelEvent = WheelEvent & {
  wheelDelta?: number;
};

type NativeGestureState = {
  anchorX: number;
  anchorY: number;
  startScale: number;
  startX: number;
  startY: number;
};

type EdgeHoverHint = {
  clientX: number;
  clientY: number;
  edgeId: string;
};

type RenderedPlanWorkstreamEdge = PlanWorkstreamEdge & {
  reciprocal?: boolean;
};

type RelationDirection = 'both' | 'in' | 'out';

type ParsedMarkdownMetadata = Array<{
  key: string;
  label: string;
  value: string | string[];
}>;

type ParsedMarkdownDocument = {
  body: string;
  metadata: ParsedMarkdownMetadata;
};

type MarkdownSection = {
  id: string;
  label: string;
  level: number;
  lineIndex: number;
};

type MarkdownSectionGroup = {
  children: MarkdownSection[];
  root: MarkdownSection;
};

type CodeRenderState = {
  highlighted: boolean;
  html: string;
};

type MarkdownRenderContext = {
  nodesByPath: Map<string, PlanWorkstreamNode>;
  nodesBySemanticId: Map<string, PlanWorkstreamNode>;
  onOpenFull: (nodeId: string) => void;
  sourceNode: PlanWorkstreamNode;
};

type SemanticSignalKind = 'decision' | 'evidence' | 'future' | 'question' | 'tension';

type SemanticSignal = {
  body: string;
  id: string;
  kind: SemanticSignalKind;
  possible?: string;
  sourceNodeId: string;
  targetSemanticId: string;
};

type EvolutionRole =
  | 'child'
  | 'follow-up'
  | 'related'
  | 'shaped-by'
  | 'shapes'
  | 'supported-by'
  | 'supports';

type EvolutionStage = 'future' | 'now' | 'past';

type AtlasView = 'board' | 'map';

type NodeFocusLevel = 'context' | 'distant' | 'normal' | 'primary';

type EvolutionEntry = {
  node: PlanWorkstreamNode;
  relationKind: PlanRelationKind;
  roles: EvolutionRole[];
  stage: EvolutionStage;
};

type AtlasRouteState = {
  fullNodeId: string | null;
  selectedNodeId: string | null;
};

const rootNodeId = 'root:planning';
const fallbackViewport: Viewport = { x: 36, y: 96, scale: 0.06 };
const minScale = 0.035;
const maxScale = 2.2;
const zoomSensitivity = 2.35;
const wheelZoomSpeed = 0.0042;
const zoomButtonStep = 0.18;
const focusScale = 0.86;
const searchMatchLimit = 12;
const evidenceDateFormatter = new Intl.DateTimeFormat('en', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'UTC',
});
const formatEvidenceRelativeTime = (value: string, now = Date.now()) => {
  const timestamp = new Date(value).getTime();

  if (!Number.isFinite(timestamp)) {
    return value;
  }

  const elapsedMilliseconds = Math.max(0, now - timestamp);
  const elapsedMinutes = Math.floor(elapsedMilliseconds / 60_000);

  if (elapsedMinutes < 1) {
    return 'just now';
  }

  if (elapsedMinutes < 60) {
    return `${elapsedMinutes}m ago`;
  }

  const elapsedHours = Math.floor(elapsedMinutes / 60);

  if (elapsedHours < 24) {
    return `${elapsedHours}h ago`;
  }

  const elapsedDays = Math.floor(elapsedHours / 24);

  if (elapsedDays < 7) {
    return `${elapsedDays}d ago`;
  }

  const elapsedWeeks = Math.floor(elapsedDays / 7);

  if (elapsedWeeks < 5) {
    return `${elapsedWeeks}w ago`;
  }

  const elapsedMonths = Math.floor(elapsedDays / 30);

  if (elapsedMonths < 12) {
    return `${elapsedMonths}mo ago`;
  }

  return `${Math.floor(elapsedDays / 365)}y ago`;
};
const allStatuses: PlanStatusGroup[] = [
  'current',
  'next',
  'backlog',
  'research',
  'done',
  'unmaterialized',
];

const emptyRouteState: AtlasRouteState = {
  fullNodeId: null,
  selectedNodeId: null,
};

const relationStyle: Record<PlanRelationKind, string> = {
  candidate: 'stroke-amber-400',
  contains: 'stroke-zinc-300',
  'follow-up': 'stroke-emerald-400',
  related: 'stroke-sky-400',
  'shaped-by': 'stroke-fuchsia-400',
  supports: 'stroke-indigo-400',
};

const statusAccentClassName = (statusGroup: PlanStatusGroup) => {
  switch (statusGroup) {
    case 'current':
      return 'border-l-emerald-500';
    case 'next':
      return 'border-l-sky-500';
    case 'research':
      return 'border-l-violet-500';
    case 'backlog':
      return 'border-l-amber-500';
    case 'done':
      return 'border-l-zinc-300';
    case 'unmaterialized':
      return 'border-l-zinc-400';
  }
};

const statusDotClassName = (statusGroup: PlanStatusGroup) => {
  switch (statusGroup) {
    case 'current':
      return 'bg-emerald-500';
    case 'next':
      return 'bg-sky-500';
    case 'research':
      return 'bg-violet-500';
    case 'backlog':
      return 'bg-amber-500';
    case 'done':
      return 'bg-zinc-300';
    case 'unmaterialized':
      return 'bg-zinc-400';
  }
};

const relationDotClassName = (kind: PlanRelationKind) => {
  switch (kind) {
    case 'candidate':
      return 'bg-amber-400';
    case 'contains':
      return 'bg-zinc-300';
    case 'follow-up':
      return 'bg-emerald-400';
    case 'related':
      return 'bg-sky-400';
    case 'shaped-by':
      return 'bg-fuchsia-400';
    case 'supports':
      return 'bg-indigo-400';
  }
};

const relationLabel = (kind: PlanRelationKind, direction: RelationDirection) => {
  if (kind === 'supports') {
    if (direction === 'both') {
      return 'mutual support';
    }

    return direction === 'in' ? 'supported by' : 'supports';
  }

  if (kind === 'shaped-by') {
    return direction === 'in' ? 'shapes' : 'shaped by';
  }

  if (kind === 'contains') {
    return direction === 'in' ? 'contained by' : 'contains';
  }

  if (kind === 'follow-up') {
    return direction === 'in' ? 'follows up' : 'follow-up';
  }

  return kind;
};

const isHierarchyRelation = (kind: PlanRelationKind) =>
  kind === 'contains' || kind === 'candidate' || kind === 'shaped-by';

const hasEdgeNavigationHint = (kind: PlanRelationKind) =>
  kind === 'follow-up' || kind === 'related' || kind === 'shaped-by' || kind === 'supports';

const hierarchyRelationPriority: Record<
  Extract<PlanRelationKind, 'contains' | 'candidate' | 'shaped-by'>,
  number
> = {
  contains: 0,
  candidate: 1,
  'shaped-by': 2,
};

const getHierarchyEdges = (edges: PlanWorkstreamEdge[]) =>
  edges
    .filter(edge => isHierarchyRelation(edge.kind))
    .sort((left, right) => {
      const leftPriority =
        left.kind === 'contains' || left.kind === 'candidate' || left.kind === 'shaped-by'
          ? hierarchyRelationPriority[left.kind]
          : 99;
      const rightPriority =
        right.kind === 'contains' || right.kind === 'candidate' || right.kind === 'shaped-by'
          ? hierarchyRelationPriority[right.kind]
          : 99;

      return leftPriority - rightPriority;
    });

const getReciprocalEdgeKey = (edge: PlanWorkstreamEdge) => [edge.from, edge.to].sort().join('<->');

const getRenderedEdges = (edges: PlanWorkstreamEdge[]): RenderedPlanWorkstreamEdge[] => {
  const supportEdgesByDirection = new Map<string, PlanWorkstreamEdge>();

  for (const edge of edges) {
    if (edge.kind !== 'supports') {
      continue;
    }

    supportEdgesByDirection.set(`${edge.from}->${edge.to}`, edge);
  }

  const renderedEdges: RenderedPlanWorkstreamEdge[] = [];
  const renderedReciprocalKeys = new Set<string>();

  for (const edge of edges) {
    if (edge.kind !== 'supports') {
      renderedEdges.push(edge);
      continue;
    }

    const reciprocalEdge = supportEdgesByDirection.get(`${edge.to}->${edge.from}`);

    if (!reciprocalEdge) {
      renderedEdges.push(edge);
      continue;
    }

    const reciprocalKey = getReciprocalEdgeKey(edge);

    if (renderedReciprocalKeys.has(reciprocalKey)) {
      continue;
    }

    const [canonicalEdge] = [edge, reciprocalEdge].sort((left, right) =>
      left.id.localeCompare(right.id),
    );

    renderedReciprocalKeys.add(reciprocalKey);
    renderedEdges.push({
      ...canonicalEdge,
      id: `${reciprocalKey}:supports:reciprocal`,
      reciprocal: true,
    });
  }

  return renderedEdges;
};

const nodeClassName = (node: PlanWorkstreamNode, selected: boolean, focusLevel: NodeFocusLevel) =>
  cn(
    'group relative z-10 rounded-md border border-l-4 bg-card/95 px-3 py-2 text-left shadow-[0_2px_12px_rgba(15,23,42,0.08)] backdrop-blur-sm transition-[border-color,box-shadow,opacity,filter] hover:border-primary/50',
    statusAccentClassName(node.statusGroup),
    node.kind === 'candidate' && 'border-dashed bg-muted/45',
    node.kind === 'project' && 'bg-background/95',
    node.kind === 'model' && 'bg-background/95',
    node.kind === 'concept' && 'bg-muted/55',
    node.kind === 'experience' && 'bg-card/95',
    node.kind === 'capability' && 'bg-card/90',
    node.kind === 'entity' && 'bg-card/90',
    node.kind === 'operation' && 'bg-card/90',
    node.kind === 'artifact' && 'bg-muted/60',
    node.kind === 'policy' && 'bg-muted/60',
    node.kind === 'state' && 'bg-muted/60',
    node.kind === 'relation' && 'bg-muted/55',
    node.kind === 'system-primitive' && 'bg-muted/65',
    node.kind === 'tooling' && 'bg-muted/60',
    node.kind === 'evidence' && 'bg-muted/60',
    node.kind === 'practice' && 'bg-muted/55',
    node.kind === 'principle' && 'bg-muted/55',
    node.kind === 'workstream' && 'bg-muted/70',
    node.kind === 'territory' && 'bg-background/95',
    node.kind === 'root' && 'border-l-foreground bg-foreground text-background',
    selected && 'border-primary ring-2 ring-primary/20',
    focusLevel === 'context' && 'opacity-70',
    focusLevel === 'distant' && 'opacity-[0.16] grayscale',
  );

const mutedNodeShieldKinds = new Set<PlanWorkstreamNode['kind']>([
  'artifact',
  'candidate',
  'concept',
  'evidence',
  'policy',
  'practice',
  'principle',
  'relation',
  'state',
  'system-primitive',
  'tooling',
  'workstream',
]);

const nodeShieldClassName = (node: PlanWorkstreamNode) =>
  cn(
    'pointer-events-none absolute inset-0 rounded-md shadow-[0_2px_12px_rgba(15,23,42,0.08)]',
    node.kind === 'root'
      ? 'bg-foreground'
      : node.kind === 'project' || node.kind === 'model' || node.kind === 'territory'
        ? 'bg-background'
        : mutedNodeShieldKinds.has(node.kind)
          ? 'bg-muted'
          : 'bg-card',
  );

const nodeFocusLevelRank: Record<NodeFocusLevel, number> = {
  context: 2,
  distant: 0,
  normal: 1,
  primary: 3,
};

const markNodeFocusLevel = (
  levels: Map<string, NodeFocusLevel>,
  visibleNodeIds: Set<string>,
  nodeId: string,
  focusLevel: Exclude<NodeFocusLevel, 'distant' | 'normal'>,
) => {
  if (!visibleNodeIds.has(nodeId)) {
    return;
  }

  const currentFocusLevel = levels.get(nodeId);

  if (
    !currentFocusLevel ||
    nodeFocusLevelRank[focusLevel] > nodeFocusLevelRank[currentFocusLevel]
  ) {
    levels.set(nodeId, focusLevel);
  }
};

const getNodeFocusLevel = (
  nodeId: string,
  focusLevels: Map<string, NodeFocusLevel> | null,
): NodeFocusLevel => {
  if (!focusLevels) {
    return 'normal';
  }

  return focusLevels.get(nodeId) ?? 'distant';
};

const getNodeFocusLevels = ({
  activeNodeIds,
  hierarchyIndex,
  visibleEdges,
  visibleNodeIds,
}: {
  activeNodeIds: Set<string>;
  hierarchyIndex: HierarchyIndex;
  visibleEdges: PlanWorkstreamEdge[];
  visibleNodeIds: Set<string>;
}) => {
  const visibleActiveNodeIds = [...activeNodeIds].filter(nodeId => visibleNodeIds.has(nodeId));

  if (visibleActiveNodeIds.length === 0) {
    return null;
  }

  const levels = new Map<string, NodeFocusLevel>();

  for (const nodeId of visibleActiveNodeIds) {
    markNodeFocusLevel(levels, visibleNodeIds, nodeId, 'primary');

    for (const ancestorId of getAncestorIds(nodeId, hierarchyIndex.parentByChild)) {
      markNodeFocusLevel(levels, visibleNodeIds, ancestorId, 'primary');
    }

    for (const descendantId of getDescendantIds(nodeId, hierarchyIndex.primaryChildrenByParent)) {
      markNodeFocusLevel(levels, visibleNodeIds, descendantId, 'primary');
    }

    const parentId = hierarchyIndex.parentByChild.get(nodeId);

    if (parentId) {
      markNodeFocusLevel(levels, visibleNodeIds, parentId, 'primary');

      for (const siblingId of hierarchyIndex.primaryChildrenByParent.get(parentId) ?? []) {
        markNodeFocusLevel(levels, visibleNodeIds, siblingId, 'context');
      }
    }

    for (const childId of hierarchyIndex.primaryChildrenByParent.get(nodeId) ?? []) {
      markNodeFocusLevel(levels, visibleNodeIds, childId, 'primary');
    }
  }

  const activeNodeIdSet = new Set(visibleActiveNodeIds);

  for (const edge of visibleEdges) {
    if (activeNodeIdSet.has(edge.from)) {
      markNodeFocusLevel(levels, visibleNodeIds, edge.to, 'context');
    }

    if (activeNodeIdSet.has(edge.to)) {
      markNodeFocusLevel(levels, visibleNodeIds, edge.from, 'context');
    }
  }

  return levels;
};

const getNodeStatusLabel = (node: PlanWorkstreamNode) =>
  node.kind === 'plan' ? node.statusGroup : node.status;

const readAtlasRouteState = (): AtlasRouteState => {
  if (typeof globalThis.window === 'undefined') {
    return emptyRouteState;
  }

  const searchParams = new URL(globalThis.location.href).searchParams;

  return {
    fullNodeId: searchParams.get('full'),
    selectedNodeId: searchParams.get('node'),
  };
};

const writeAtlasRouteState = (state: AtlasRouteState, mode: 'push' | 'replace' = 'push') => {
  if (typeof globalThis.window === 'undefined') {
    return;
  }

  const nextUrl = new URL(globalThis.location.href);

  if (state.selectedNodeId) {
    nextUrl.searchParams.set('node', state.selectedNodeId);
  } else {
    nextUrl.searchParams.delete('node');
  }

  if (state.fullNodeId) {
    nextUrl.searchParams.set('full', state.fullNodeId);
  } else {
    nextUrl.searchParams.delete('full');
  }

  const currentPath = `${globalThis.location.pathname}${globalThis.location.search}${globalThis.location.hash}`;
  const nextPath = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;

  if (currentPath === nextPath) {
    return;
  }

  const historyMethod = mode === 'replace' ? 'replaceState' : 'pushState';
  globalThis.history[historyMethod]({ atlas: true }, '', nextUrl);
};

const clampScale = (value: number) => Math.min(maxScale, Math.max(minScale, value));
const getZoomSensitivityMultiplier = (scale: number) => {
  const normalizedScale = Math.max(minScale, scale);
  const distanceFromMinScale = Math.log(normalizedScale / minScale);
  const farZoomBoost = Math.max(0, 1.25 - distanceFromMinScale / 1.45);
  const closeZoomDampening = normalizedScale > 0.9 ? 0.9 : 1;

  return closeZoomDampening * (1 + farZoomBoost);
};
const amplifyZoomRatio = (ratio: number, currentScale: number) =>
  ratio ** (zoomSensitivity * getZoomSensitivityMultiplier(currentScale));
const normalizeSearchValue = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const getPlanNumber = (node: PlanWorkstreamNode) => {
  if (node.kind !== 'plan') {
    return null;
  }

  return (
    (node.path ?? node.semanticId ?? node.shortTitle)
      .match(/(?:^|\/)(\d+[a-z]*)[-–]/i)?.[1]
      ?.toLowerCase() ?? null
  );
};

const getPlanNumberAliases = (planNumber: string) => {
  const aliases = new Set([planNumber]);
  const withoutLeadingZeroes = planNumber.replace(/^0+(?=\d)/, '');

  if (withoutLeadingZeroes) {
    aliases.add(withoutLeadingZeroes);
  }

  return [...aliases];
};

const getPlanSearchTokens = (node: PlanWorkstreamNode) => {
  if (node.kind !== 'plan') {
    return [];
  }

  const planNumber = getPlanNumber(node);

  if (!planNumber) {
    return [];
  }

  return getPlanNumberAliases(planNumber).flatMap(alias => [
    alias,
    `#${alias}`,
    `p${alias}`,
    `plan ${alias}`,
    `plan-${alias}`,
    `plan:${alias}`,
  ]);
};

const getSearchText = (node: PlanWorkstreamNode) =>
  normalizeSearchValue(
    [
      node.title,
      node.shortTitle,
      node.status,
      node.path,
      node.semanticId,
      node.area,
      node.codename,
      node.territory,
      node.workstream,
      ...(node.exemplars ?? []),
      ...getPlanSearchTokens(node),
    ]
      .filter(Boolean)
      .join(' '),
  );

const getSearchMatchRank = (node: PlanWorkstreamNode, query: string) => {
  if (node.kind !== 'plan') {
    return 1;
  }

  const planNumber = getPlanNumber(node);

  if (!planNumber) {
    return 1;
  }

  const exactPlanQueries = getPlanNumberAliases(planNumber).flatMap(alias => [
    alias,
    `#${alias}`,
    `p${alias}`,
    `plan ${alias}`,
    `plan-${alias}`,
    `plan:${alias}`,
  ]);

  return exactPlanQueries.includes(query) ? 0 : 1;
};

type HierarchyIndex = {
  parentByChild: Map<string, string>;
  primaryChildrenByParent: Map<string, string[]>;
};

const getHierarchyIndex = (
  nodes: PlanWorkstreamNode[],
  edges: PlanWorkstreamEdge[],
): HierarchyIndex => {
  const nodeIds = new Set(nodes.map(node => node.id));
  const parentByChild = new Map<string, string>();
  const primaryChildrenByParent = new Map<string, string[]>();

  for (const edge of getHierarchyEdges(edges)) {
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) {
      continue;
    }

    if (!parentByChild.has(edge.to)) {
      parentByChild.set(edge.to, edge.from);
      primaryChildrenByParent.set(edge.from, [
        ...(primaryChildrenByParent.get(edge.from) ?? []),
        edge.to,
      ]);
    }
  }

  return { parentByChild, primaryChildrenByParent };
};

const getAncestorIds = (nodeId: string, parentByChild: Map<string, string>) => {
  const ancestorIds: string[] = [];
  let currentId = nodeId;

  while (parentByChild.has(currentId)) {
    const parentId = parentByChild.get(currentId);

    if (!parentId || ancestorIds.includes(parentId)) {
      break;
    }

    ancestorIds.push(parentId);
    currentId = parentId;
  }

  return ancestorIds;
};

const getDescendantIds = (nodeId: string, childrenByParent: Map<string, string[]>) => {
  const descendantIds: string[] = [];
  const pendingIds = [...(childrenByParent.get(nodeId) ?? [])];

  while (pendingIds.length > 0) {
    const descendantId = pendingIds.shift();

    if (!descendantId || descendantIds.includes(descendantId)) {
      continue;
    }

    descendantIds.push(descendantId);
    pendingIds.push(...(childrenByParent.get(descendantId) ?? []));
  }

  return descendantIds;
};

const getInitialExpandedNodeIds = (nodes: PlanWorkstreamNode[], edges: PlanWorkstreamEdge[]) => {
  const { primaryChildrenByParent } = getHierarchyIndex(nodes, edges);
  const expandedIds = new Set<string>([rootNodeId]);

  if (!primaryChildrenByParent.has(rootNodeId) && nodes.length > 0) {
    expandedIds.add(nodes[0]?.id ?? rootNodeId);
  }

  return expandedIds;
};

const getStatusVisibleNodeIds = (
  nodes: PlanWorkstreamNode[],
  edges: PlanWorkstreamEdge[],
  statuses: PlanStatusGroup[],
) => {
  const directMatches = nodes.filter(node => {
    if (!statuses.includes(node.statusGroup)) {
      return false;
    }

    return true;
  });
  const visibleIds = new Set(directMatches.map(node => node.id));
  let changed = true;

  while (changed) {
    changed = false;

    for (const edge of edges) {
      if (visibleIds.has(edge.to) && !visibleIds.has(edge.from)) {
        visibleIds.add(edge.from);
        changed = true;
      }
    }
  }

  return visibleIds;
};

const getExpandedVisibleNodeIds = (
  nodes: PlanWorkstreamNode[],
  statusVisibleIds: Set<string>,
  parentByChild: Map<string, string>,
  expandedNodeIds: Set<string>,
) => {
  const visibleIds = new Set<string>();

  for (const node of nodes) {
    if (!statusVisibleIds.has(node.id)) {
      continue;
    }

    const isVisible = getAncestorIds(node.id, parentByChild).every(ancestorId =>
      expandedNodeIds.has(ancestorId),
    );

    if (isVisible) {
      visibleIds.add(node.id);
    }
  }

  return visibleIds;
};

const getSearchMatches = (nodes: PlanWorkstreamNode[], query: string) => {
  const normalizedQuery = normalizeSearchValue(query).trim();
  const terms = normalizedQuery.split(/\s+/).filter(Boolean);

  if (terms.length === 0) {
    return [];
  }

  return nodes
    .map((node, index) => ({
      index,
      node,
      rank: getSearchMatchRank(node, normalizedQuery),
      text: getSearchText(node),
    }))
    .filter(match => match.node.kind !== 'root' && terms.every(term => match.text.includes(term)))
    .sort((left, right) => left.rank - right.rank || left.index - right.index)
    .map(match => match.node)
    .slice(0, searchMatchLimit);
};

const getSearchSourceParts = (node: PlanWorkstreamNode) => {
  const source = node.path ?? node.semanticId;

  if (!source) {
    return null;
  }

  const schemeMatch = source.match(/^([a-z][a-z\d+.-]*:\/\/)(.*)$/i);

  return {
    location: schemeMatch?.[2] ?? source,
    scheme: schemeMatch?.[1]?.replace('://', '') ?? null,
    source,
  };
};

const getGraphLayout = (nodes: PlanWorkstreamNode[], edges: PlanWorkstreamEdge[]) => {
  const nodesById = new Map(nodes.map(node => [node.id, node]));
  const orderById = new Map(nodes.map((node, index) => [node.id, index]));
  const childrenByParent = new Map<string, string[]>();
  const parentByChild = new Map<string, string>();
  const parentIds = new Set<string>();

  for (const edge of getHierarchyEdges(edges)) {
    if (!nodesById.has(edge.from) || !nodesById.has(edge.to)) {
      continue;
    }

    if (parentByChild.has(edge.to)) {
      continue;
    }

    parentByChild.set(edge.to, edge.from);
    childrenByParent.set(edge.from, [...(childrenByParent.get(edge.from) ?? []), edge.to]);
    parentIds.add(edge.to);
  }

  for (const [parentId, children] of childrenByParent) {
    childrenByParent.set(
      parentId,
      [...children].sort((left, right) => (orderById.get(left) ?? 0) - (orderById.get(right) ?? 0)),
    );
  }

  const positioned = new Map<string, PositionedNode>();
  const visited = new Set<string>();
  const columnWidth = 286;
  const nodeWidth = 228;
  const nodeHeight = 70;
  const rowGap = 92;
  const columnNodeGap = 24;
  let cursorY = 24;
  let maxDepth = 0;

  const placeNode = (nodeId: string, depth: number): number => {
    const node = nodesById.get(nodeId);

    if (!node || visited.has(nodeId)) {
      return cursorY;
    }

    visited.add(nodeId);
    maxDepth = Math.max(maxDepth, depth);

    const children = childrenByParent.get(nodeId) ?? [];
    let y = cursorY;

    if (children.length === 0) {
      cursorY += rowGap;
    } else {
      const childPositions = children.map(childId => placeNode(childId, depth + 1));
      y = (Math.min(...childPositions) + Math.max(...childPositions)) / 2;
    }

    positioned.set(nodeId, {
      ...node,
      height: nodeHeight,
      width: nodeWidth,
      x: 24 + depth * columnWidth,
      y,
    });

    return y;
  };

  if (nodesById.has(rootNodeId)) {
    placeNode(rootNodeId, 0);
  }

  for (const node of nodes) {
    if (!visited.has(node.id) && !parentIds.has(node.id)) {
      placeNode(node.id, node.kind === 'candidate' ? 4 : 2);
    }
  }

  for (const node of nodes) {
    if (!visited.has(node.id)) {
      placeNode(node.id, node.kind === 'candidate' ? 4 : 2);
    }
  }

  const nodesByColumn = new Map<number, PositionedNode[]>();

  for (const node of positioned.values()) {
    nodesByColumn.set(node.x, [...(nodesByColumn.get(node.x) ?? []), node]);
  }

  for (const columnNodes of nodesByColumn.values()) {
    let nextY = 24;

    for (const node of columnNodes.sort((left, right) => left.y - right.y)) {
      if (node.y < nextY) {
        node.y = nextY;
      }

      nextY = node.y + node.height + columnNodeGap;
    }
  }

  const positionedNodes = [...positioned.values()];
  const contentHeight = Math.max(...positionedNodes.map(node => node.y + node.height), cursorY);

  return {
    height: Math.max(contentHeight + 24, 720),
    nodes: positionedNodes,
    positioned,
    width: 48 + (maxDepth + 1) * columnWidth,
  };
};

const edgePath = (from: PositionedNode, to: PositionedNode) => {
  const startX = from.x + from.width;
  const startY = from.y + from.height / 2;
  const endX = to.x;
  const endY = to.y + to.height / 2;
  const midX = startX + Math.max(48, (endX - startX) / 2);

  return `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`;
};

const getPointerDistance = (left: PointerPoint, right: PointerPoint) =>
  Math.hypot(left.clientX - right.clientX, left.clientY - right.clientY);

const getPointerCenter = (left: PointerPoint, right: PointerPoint, rect: DOMRect) => ({
  x: (left.clientX + right.clientX) / 2 - rect.left,
  y: (left.clientY + right.clientY) / 2 - rect.top,
});

const getEdgeHintPosition = (hint: EdgeHoverHint) => {
  if (typeof globalThis.window === 'undefined') {
    return { left: hint.clientX + 14, top: hint.clientY + 14 };
  }

  return {
    left: Math.min(hint.clientX + 14, globalThis.window.innerWidth - 280),
    top: Math.min(hint.clientY + 14, globalThis.window.innerHeight - 96),
  };
};

const IconButton = ({
  active,
  children,
  label,
  onClick,
}: {
  active?: boolean;
  children: ReactNode;
  label: string;
  onClick: () => void;
}) => (
  <button
    type='button'
    aria-label={label}
    aria-pressed={active}
    title={label}
    className={cn(
      'inline-flex size-9 items-center justify-center rounded-md border border-border/70 bg-background/75 text-muted-foreground shadow-sm backdrop-blur-xl transition-colors hover:text-foreground',
      active && 'border-primary/55 bg-primary/10 text-foreground',
    )}
    onClick={onClick}
  >
    {children}
  </button>
);

const BranchSproutToggle = ({
  directChildCount,
  expanded,
  focusLevel,
  nodeId,
  onToggle,
  totalDescendantCount,
}: {
  directChildCount: number;
  expanded: boolean;
  focusLevel: NodeFocusLevel;
  nodeId: string;
  onToggle: () => void;
  totalDescendantCount: number;
}) => {
  if (directChildCount === 0) {
    return null;
  }

  if (expanded) {
    return (
      <button
        type='button'
        aria-label='Collapse branch'
        aria-expanded={expanded}
        data-collapse-toggle
        data-collapse-node-id={nodeId}
        title='Collapse branch'
        className={cn(
          'absolute left-[220px] top-1/2 z-30 grid size-5 -translate-y-1/2 place-items-center rounded-full border border-primary/45 bg-background/85 text-muted-foreground shadow-sm backdrop-blur-sm transition-[opacity,transform,border-color,color] hover:scale-110 hover:border-primary/70 hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary/35',
          focusLevel === 'context' && 'opacity-70',
          focusLevel === 'distant' && 'opacity-25 grayscale',
        )}
        onClick={event => {
          event.preventDefault();
          event.stopPropagation();

          if (event.detail === 0) {
            onToggle();
          }
        }}
      >
        <Minus className='size-3' />
      </button>
    );
  }

  return (
    <button
      type='button'
      aria-label={`Expand branch: ${directChildCount} direct children, ${totalDescendantCount} total descendants`}
      aria-expanded={expanded}
      data-collapse-toggle
      data-collapse-node-id={nodeId}
      title={`${directChildCount} direct children / ${totalDescendantCount} total descendants`}
      className={cn(
        'absolute left-[220px] top-1/2 z-30 flex w-max -translate-y-1/2 items-center gap-1 rounded-full px-0.5 py-0.5 text-muted-foreground transition-[opacity,transform,color] hover:scale-110 hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary/35',
        focusLevel === 'context' && 'opacity-70',
        focusLevel === 'distant' && 'opacity-25 grayscale',
      )}
      onClick={event => {
        event.preventDefault();
        event.stopPropagation();

        if (event.detail === 0) {
          onToggle();
        }
      }}
    >
      <span className='grid size-5 place-items-center rounded-full border border-primary/45 bg-background/85 shadow-sm backdrop-blur-sm'>
        <Plus className='size-3.5' />
      </span>
      <span
        aria-hidden='true'
        className='whitespace-nowrap rounded-full bg-background/75 px-1.5 py-0.5 font-mono text-[10px] leading-none shadow-sm backdrop-blur-sm'
      >
        {directChildCount} / {totalDescendantCount}
      </span>
    </button>
  );
};

const NodeCard = ({
  focusLevel,
  node,
  onDoubleClick,
  onSelect,
  selected,
}: {
  focusLevel: NodeFocusLevel;
  node: PlanWorkstreamNode;
  onDoubleClick: () => void;
  onSelect: () => void;
  selected: boolean;
}) => (
  <div
    role='button'
    tabIndex={0}
    aria-label={node.shortTitle}
    data-node-id={node.id}
    className={nodeClassName(node, selected, focusLevel)}
    onDoubleClick={event => {
      event.stopPropagation();
      onDoubleClick();
    }}
    onKeyDown={event => {
      if (event.key !== 'Enter' && event.key !== ' ') {
        return;
      }

      event.preventDefault();
      onSelect();
    }}
    style={{ height: 70, touchAction: 'none', width: 228 }}
  >
    <div className='flex items-center justify-between gap-2'>
      <span
        className={cn(
          'truncate font-mono text-[10px] uppercase text-muted-foreground',
          node.kind === 'root' && 'text-background/70',
        )}
      >
        {node.kind}
      </span>
      <span
        className={cn(
          'flex items-center gap-1.5 text-[11px] text-muted-foreground',
          node.kind === 'root' && 'text-background/70',
        )}
      >
        <span className={cn('size-1.5 rounded-full', statusDotClassName(node.statusGroup))} />
        {getNodeStatusLabel(node)}
      </span>
    </div>
    <div className='mt-1.5 line-clamp-2 text-sm font-medium leading-snug'>{node.shortTitle}</div>
  </div>
);

type DrawerRelation = {
  direction: RelationDirection;
  id: string;
  kind: PlanRelationKind;
  otherNodeId: string;
};

const mergeDrawerRelations = (
  nodeId: string,
  incoming: PlanWorkstreamEdge[],
  outgoing: PlanWorkstreamEdge[],
) => {
  const hierarchy: DrawerRelation[] = [];
  const relationsByKey = new Map<string, DrawerRelation>();

  for (const edge of [...outgoing, ...incoming]) {
    const direction = edge.from === nodeId ? 'out' : 'in';
    const otherNodeId = direction === 'out' ? edge.to : edge.from;

    if (isHierarchyRelation(edge.kind)) {
      hierarchy.push({
        direction,
        id: `${edge.id}:${direction}`,
        kind: edge.kind,
        otherNodeId,
      });
      continue;
    }

    const key = `${edge.kind}:${otherNodeId}`;
    const existing = relationsByKey.get(key);

    if (existing) {
      relationsByKey.set(key, {
        ...existing,
        direction: existing.direction === direction ? direction : 'both',
      });
      continue;
    }

    relationsByKey.set(key, {
      direction,
      id: key,
      kind: edge.kind,
      otherNodeId,
    });
  }

  return {
    hierarchy,
    relations: [...relationsByKey.values()],
  };
};

const RelationList = ({
  nodesById,
  onSelect,
  relations,
}: {
  nodesById: Map<string, PlanWorkstreamNode>;
  onSelect: (nodeId: string) => void;
  relations: DrawerRelation[];
}) =>
  relations.length === 0 ? (
    <p className='text-xs text-muted-foreground'>None</p>
  ) : (
    <div className='flex flex-wrap gap-2'>
      {relations.slice(0, 10).map(relation => {
        const otherNode = nodesById.get(relation.otherNodeId);
        const label = relationLabel(relation.kind, relation.direction);

        return (
          <button
            key={relation.id}
            type='button'
            className='inline-flex max-w-full items-center gap-2 rounded-md border border-border/70 bg-background/65 px-2.5 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground'
            onClick={() => onSelect(relation.otherNodeId)}
          >
            <span
              className={cn('size-1.5 shrink-0 rounded-full', relationDotClassName(relation.kind))}
            />
            <span className='font-mono'>{label}</span>
            <span className='truncate'>{otherNode?.shortTitle ?? relation.otherNodeId}</span>
          </button>
        );
      })}
    </div>
  );

const ExemplarList = ({
  exemplars,
  nodesBySemanticId,
  onSelect,
}: {
  exemplars: string[];
  nodesBySemanticId: Map<string, PlanWorkstreamNode>;
  onSelect: (nodeId: string) => void;
}) => (
  <div className='flex flex-wrap gap-2'>
    {exemplars.map(exemplar => {
      const target = resolveAtlasReferenceNode(exemplar, nodesBySemanticId);
      const label = target?.shortTitle ?? target?.title ?? labelFromAtlasReference(exemplar);

      return target ? (
        <button
          key={exemplar}
          type='button'
          className='inline-flex max-w-full items-center rounded-md border border-sky-300/30 bg-sky-300/10 px-2.5 py-1 text-left text-xs font-medium text-sky-300 transition-colors hover:border-sky-300/60 hover:bg-sky-300/15 hover:text-sky-200'
          title={target.semanticId ?? target.path}
          onClick={() => onSelect(target.id)}
        >
          <span className='truncate'>{label}</span>
        </button>
      ) : (
        <span
          key={exemplar}
          className='inline-flex max-w-full items-center rounded-md border border-dashed border-border/80 bg-background/45 px-2.5 py-1 text-xs text-muted-foreground'
          title={exemplar}
        >
          <span className='truncate'>{label}</span>
        </span>
      );
    })}
  </div>
);

const SemanticSignalList = ({
  markdownContext,
  nodesById,
  onOpenFull,
  showKind = true,
  signals,
}: {
  markdownContext: MarkdownRenderContext;
  nodesById: Map<string, PlanWorkstreamNode>;
  onOpenFull: (nodeId: string) => void;
  showKind?: boolean;
  signals: SemanticSignal[];
}) =>
  signals.length === 0 ? null : (
    <div className='grid gap-2'>
      {signals.slice(0, 6).map(signal => {
        const sourceNode = nodesById.get(signal.sourceNodeId);
        const sourceContext: MarkdownRenderContext = {
          ...markdownContext,
          sourceNode: sourceNode ?? markdownContext.sourceNode,
        };

        return (
          <div
            key={signal.id}
            className='rounded-md border border-border/70 bg-background/55 px-3 py-2.5'
          >
            <div className='mb-1.5 flex flex-wrap items-center gap-2'>
              {showKind ? (
                <span
                  className={cn(
                    'rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase',
                    semanticSignalClassName(signal.kind),
                  )}
                >
                  {semanticSignalLabel(signal.kind)}
                </span>
              ) : null}
              {sourceNode ? (
                <>
                  <span className='rounded border border-border/70 bg-card/70 px-1.5 py-0.5 font-mono text-[10px] uppercase text-muted-foreground'>
                    {sourceNode.kind}
                  </span>
                  <button
                    type='button'
                    className='min-w-0 truncate text-left text-[11px] text-muted-foreground underline decoration-muted-foreground/30 underline-offset-4 transition-colors hover:text-foreground'
                    title={sourceNode.path ?? sourceNode.semanticId}
                    onClick={() => onOpenFull(sourceNode.id)}
                  >
                    {sourceNode.shortTitle}
                  </button>
                </>
              ) : null}
            </div>
            {signal.body ? (
              <p className='text-xs leading-5 text-muted-foreground'>
                {renderMarkdownInline(signal.body, sourceContext)}
              </p>
            ) : null}
            {signal.possible ? (
              <p className='mt-1.5 text-xs leading-5 text-muted-foreground'>
                <span className='font-medium text-foreground'>Possible: </span>
                {renderMarkdownInline(signal.possible, sourceContext)}
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );

const getEvolutionStage = (node: PlanWorkstreamNode): EvolutionStage => {
  if (node.statusGroup === 'done') {
    return 'past';
  }

  if (
    node.statusGroup === 'next' ||
    node.statusGroup === 'backlog' ||
    node.statusGroup === 'research' ||
    node.statusGroup === 'unmaterialized' ||
    node.status === 'idea' ||
    node.horizon === 'later'
  ) {
    return 'future';
  }

  return 'now';
};

type BoardColumnKey = 'later' | 'next' | 'now' | 'past';

const getBoardColumnKey = (node: PlanWorkstreamNode): BoardColumnKey => {
  if (node.statusGroup === 'done') {
    return 'past';
  }

  if (node.statusGroup === 'next') {
    return 'next';
  }

  return getEvolutionStage(node) === 'future' ? 'later' : 'now';
};

const sortBoardNodes = (nodes: PlanWorkstreamNode[]) =>
  [...nodes].sort((left, right) => {
    const statusDelta =
      allStatuses.indexOf(left.statusGroup) - allStatuses.indexOf(right.statusGroup);

    if (statusDelta !== 0) {
      return statusDelta;
    }

    const kindDelta = left.kind.localeCompare(right.kind);

    if (kindDelta !== 0) {
      return kindDelta;
    }

    return left.shortTitle.localeCompare(right.shortTitle);
  });

const evolutionRoleLabel = (role: EvolutionRole) => {
  switch (role) {
    case 'child':
      return 'sub-shape';
    case 'follow-up':
      return 'follow-up';
    case 'related':
      return 'related';
    case 'shaped-by':
      return 'shaped by';
    case 'shapes':
      return 'shapes';
    case 'supported-by':
      return 'supported by';
    case 'supports':
      return 'supports';
  }
};

const getEvolutionEntries = (
  nodeId: string,
  edges: PlanWorkstreamEdge[],
  nodesById: Map<string, PlanWorkstreamNode>,
) => {
  const sourceNode = nodesById.get(nodeId);
  const ancestorNodeIds = new Set(
    getNodeBreadcrumb(nodeId, edges, nodesById).map(ancestor => ancestor.id),
  );
  const entriesByNodeId = new Map<string, EvolutionEntry>();
  const addEntry = (targetNodeId: string, role: EvolutionRole, relationKind: PlanRelationKind) => {
    const targetNode = nodesById.get(targetNodeId);

    if (!targetNode || targetNode.id === nodeId || ancestorNodeIds.has(targetNode.id)) {
      return;
    }

    if (
      sourceNode &&
      targetNode.kind === 'plan' &&
      normalizeSearchValue(targetNode.shortTitle) === normalizeSearchValue(sourceNode.shortTitle)
    ) {
      return;
    }

    const existingEntry = entriesByNodeId.get(targetNode.id);

    if (existingEntry) {
      if (!existingEntry.roles.includes(role)) {
        existingEntry.roles.push(role);
      }

      return;
    }

    entriesByNodeId.set(targetNode.id, {
      node: targetNode,
      relationKind,
      roles: [role],
      stage: getEvolutionStage(targetNode),
    });
  };

  for (const edge of edges) {
    if (edge.from === nodeId) {
      // Evolution is a local work lens. Broad context such as supports/related stays in the map
      // and drawer relation lists so this board can expose children, shaping work, and holes.
      if (edge.kind === 'contains') {
        addEntry(edge.to, 'child', edge.kind);
      } else if (sourceNode?.kind === 'plan' && edge.kind === 'follow-up') {
        addEntry(edge.to, 'follow-up', edge.kind);
      } else if (edge.kind === 'shaped-by') {
        addEntry(edge.to, 'shaped-by', edge.kind);
      }
    }

    if (edge.to === nodeId) {
      if (edge.kind === 'shaped-by') {
        addEntry(edge.from, 'shapes', edge.kind);
      }
    }
  }

  return [...entriesByNodeId.values()].sort((left, right) => {
    const stageOrder: Record<EvolutionStage, number> = { past: 0, now: 1, future: 2 };
    const stageDelta = stageOrder[left.stage] - stageOrder[right.stage];

    if (stageDelta !== 0) {
      return stageDelta;
    }

    const statusDelta =
      allStatuses.indexOf(left.node.statusGroup) - allStatuses.indexOf(right.node.statusGroup);

    if (statusDelta !== 0) {
      return statusDelta;
    }

    return left.node.shortTitle.localeCompare(right.node.shortTitle);
  });
};

const getContextHierarchyRelations = (relations: DrawerRelation[]) =>
  relations.filter(relation => {
    if (relation.kind === 'contains') {
      return false;
    }

    if (relation.kind === 'shaped-by') {
      return false;
    }

    return true;
  });

const getNodeBreadcrumb = (
  nodeId: string,
  edges: PlanWorkstreamEdge[],
  nodesById: Map<string, PlanWorkstreamNode>,
) => {
  const breadcrumb: PlanWorkstreamNode[] = [];
  const visitedNodeIds = new Set<string>();
  let currentNodeId = nodeId;

  while (!visitedNodeIds.has(currentNodeId)) {
    visitedNodeIds.add(currentNodeId);
    const parentEdge = edges.find(edge => edge.kind === 'contains' && edge.to === currentNodeId);

    if (!parentEdge) {
      break;
    }

    const parentNode = nodesById.get(parentEdge.from);

    if (!parentNode || parentNode.kind === 'root') {
      break;
    }

    breadcrumb.unshift(parentNode);
    currentNodeId = parentNode.id;
  }

  return breadcrumb;
};

const EvolutionEntryList = ({
  entries,
  markdownContext,
  onOpenFull,
}: {
  entries: EvolutionEntry[];
  markdownContext: MarkdownRenderContext;
  onOpenFull: (nodeId: string) => void;
}) =>
  entries.length === 0 ? null : (
    <div className='grid gap-2'>
      {entries.map(entry => {
        const entryMarkdownContext = {
          ...markdownContext,
          sourceNode: entry.node,
        };

        return (
          <div
            key={entry.node.id}
            className='grid gap-2 rounded-md border border-border/70 bg-background/45 px-3 py-2.5 text-left transition-colors hover:border-primary/45 hover:bg-muted/35'
          >
            <span className='flex min-w-0 flex-wrap items-center gap-2'>
              <span
                className={cn('size-1.5 rounded-full', statusDotClassName(entry.node.statusGroup))}
              />
              <span className='font-mono text-[10px] uppercase text-muted-foreground'>
                {entry.node.kind}
              </span>
              {entry.roles.map(role => (
                <span
                  key={role}
                  className='inline-flex items-center gap-1.5 rounded border border-border/70 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground'
                >
                  <span
                    className={cn('size-1 rounded-full', relationDotClassName(entry.relationKind))}
                  />
                  {evolutionRoleLabel(role)}
                </span>
              ))}
            </span>
            <button
              type='button'
              className='line-clamp-2 text-left text-sm font-medium text-foreground transition-colors hover:text-sky-300'
              onClick={() => onOpenFull(entry.node.id)}
            >
              {entry.node.shortTitle}
            </button>
            {entry.node.summary ? (
              <ShapeContentSummary
                className='line-clamp-2 text-xs leading-5 text-muted-foreground'
                context={entryMarkdownContext}
                text={entry.node.summary}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );

const PullRequestEvidenceSection = ({ evidence }: { evidence: PlanWorkstreamEvidence[] }) =>
  evidence.length === 0 ? null : (
    <section
      aria-label='Implementation evidence'
      className='flex shrink-0 flex-col gap-2 border-b border-border/70 pb-4 sm:flex-row sm:items-center sm:gap-4'
    >
      <header className='flex shrink-0 items-center justify-between gap-3 sm:block sm:w-32'>
        <h3 className='font-mono text-[11px] uppercase text-foreground'>Implementation</h3>
        <span className='mt-1 block font-mono text-[10px] uppercase text-emerald-700 dark:text-emerald-300'>
          {evidence.length} merged {evidence.length === 1 ? 'PR' : 'PRs'}
        </span>
      </header>
      <div className='flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1'>
        {evidence.map(binding => {
          const actors = [
            {
              avatarUrl: binding.pullRequest.authorAvatarUrl,
              login: binding.pullRequest.authorLogin,
              role: 'PR author',
            },
            {
              avatarUrl: binding.pullRequest.mergedByAvatarUrl,
              login: binding.pullRequest.mergedByLogin,
              role: 'Merged PR',
            },
          ].reduce<Array<{ avatarUrl: string | null; login: string; roles: string[] }>>(
            (entries, actor) => {
              if (!actor.login) {
                return entries;
              }

              const existing = entries.find(
                entry => entry.login.toLowerCase() === actor.login?.toLowerCase(),
              );

              if (existing) {
                existing.avatarUrl ??= actor.avatarUrl;
                existing.roles.push(actor.role);
              } else {
                entries.push({
                  avatarUrl: actor.avatarUrl,
                  login: actor.login,
                  roles: [actor.role],
                });
              }

              return entries;
            },
            [],
          );

          return (
            <a
              key={binding.id}
              className='flex min-w-[min(18rem,78vw)] max-w-sm flex-1 items-center gap-2 rounded-md border border-emerald-500/25 bg-emerald-500/[0.04] px-2.5 py-2 text-left transition-colors hover:border-emerald-400/55 hover:bg-emerald-500/[0.08]'
              href={binding.pullRequest.url}
              rel='noreferrer'
              target='_blank'
            >
              <span className='grid size-7 shrink-0 place-items-center rounded-full border border-emerald-500/25 bg-emerald-500/10'>
                <GitPullRequest className='size-3.5 text-emerald-500 dark:text-emerald-300' />
              </span>
              <span className='min-w-0 flex-1'>
                <span className='flex min-w-0 items-baseline gap-1.5'>
                  <span className='truncate text-xs font-medium text-foreground'>
                    {binding.pullRequest.title}
                  </span>
                  <span className='shrink-0 font-mono text-[10px] text-muted-foreground'>
                    #{binding.pullRequest.number}
                  </span>
                </span>
                <span
                  className='mt-0.5 block truncate text-[10px] text-muted-foreground'
                  title={evidenceDateFormatter.format(new Date(binding.pullRequest.mergedAt))}
                >
                  {formatEvidenceRelativeTime(binding.pullRequest.mergedAt)}
                </span>
              </span>
              {actors.length > 0 ? (
                <span aria-label='Pull request actors' className='flex shrink-0 -space-x-2'>
                  {actors.map(actor => {
                    const details = `@${actor.login} · ${actor.roles.join(' · ')}`;
                    const avatarUrl =
                      actor.avatarUrl ?? `https://github.com/${actor.login}.png?size=64`;

                    return (
                      <span
                        key={actor.login}
                        className='group/actor relative block rounded-full ring-2 ring-background'
                        title={details}
                      >
                        <img
                          alt={`${details} avatar`}
                          className='size-5 rounded-full bg-muted object-cover'
                          height={20}
                          loading='lazy'
                          src={avatarUrl}
                          width={20}
                        />
                        <span
                          role='tooltip'
                          className='pointer-events-none absolute bottom-full right-0 z-20 mb-2 w-max max-w-52 translate-y-1 rounded-md border border-border/80 bg-popover px-2 py-1 text-[10px] font-medium text-popover-foreground opacity-0 shadow-lg transition-[opacity,transform] group-hover/actor:translate-y-0 group-hover/actor:opacity-100'
                        >
                          {details}
                        </span>
                      </span>
                    );
                  })}
                </span>
              ) : null}
              <ExternalLink className='size-3.5 shrink-0 text-muted-foreground' />
            </a>
          );
        })}
      </div>
    </section>
  );

const EvolutionBoardColumn = ({
  children,
  count,
  subtitle,
  title,
}: {
  children: ReactNode;
  count: number;
  subtitle: string;
  title: string;
}) => (
  <section className='flex min-h-[220px] flex-col border-border/70 lg:min-h-0 lg:border-l lg:pl-4 lg:first:border-l-0 lg:first:pl-0'>
    <header className='shrink-0 pb-3 text-center' title={`${subtitle} ${count} item(s).`}>
      <h3 className='font-mono text-xs uppercase text-foreground'>{title}</h3>
      <div className='mx-auto mt-2 h-px w-12 bg-border/80' />
    </header>
    <div className='min-h-0 flex-1 lg:overflow-y-auto lg:pr-2'>
      {count > 0 ? <div className='grid gap-2'>{children}</div> : null}
    </div>
  </section>
);

const GlobalBoardNodeCard = ({
  breadcrumb,
  markdownContext,
  node,
  onOpenFull,
  registerNode,
  selected,
}: {
  breadcrumb: PlanWorkstreamNode[];
  markdownContext: MarkdownRenderContext;
  node: PlanWorkstreamNode;
  onOpenFull: (nodeId: string) => void;
  registerNode: (nodeId: string, element: HTMLElement | null) => void;
  selected: boolean;
}) => {
  const nodeMarkdownContext = {
    ...markdownContext,
    sourceNode: node,
  };

  return (
    <article
      ref={element => registerNode(node.id, element)}
      data-board-node-id={node.id}
      className={cn(
        'grid gap-2 rounded-md border border-border/70 bg-background/55 px-3 py-3 text-left shadow-sm transition-[background-color,border-color,box-shadow] hover:border-primary/45 hover:bg-muted/35',
        selected && 'border-primary/70 bg-primary/10 shadow-[0_0_0_2px_hsl(var(--primary)/0.18)]',
      )}
    >
      <div className='flex min-w-0 items-center gap-2'>
        <span className={cn('size-1.5 rounded-full', statusDotClassName(node.statusGroup))} />
        <span className='font-mono text-[10px] uppercase text-muted-foreground'>{node.kind}</span>
      </div>

      {breadcrumb.length > 0 ? (
        <div className='flex min-w-0 items-center gap-1 overflow-hidden text-[10px] text-muted-foreground/80'>
          {breadcrumb.slice(-3).map((crumb, crumbIndex) => (
            <Fragment key={crumb.id}>
              {crumbIndex > 0 ? <span className='text-muted-foreground/45'>/</span> : null}
              <span className='truncate'>{crumb.shortTitle}</span>
            </Fragment>
          ))}
        </div>
      ) : null}

      <button
        type='button'
        className='line-clamp-2 text-left text-sm font-medium leading-snug text-foreground transition-colors hover:text-sky-300'
        onClick={() => onOpenFull(node.id)}
      >
        {node.shortTitle}
      </button>

      {node.summary ? (
        <ShapeContentSummary
          className='line-clamp-3 text-xs leading-5 text-muted-foreground'
          context={nodeMarkdownContext}
          text={node.summary}
        />
      ) : null}
    </article>
  );
};

const GlobalBoardNodeList = ({
  markdownContext,
  nodes,
  nodesById,
  onOpenFull,
  registerNode,
  selectedNodeId,
  snapshotEdges,
}: {
  markdownContext: MarkdownRenderContext;
  nodes: PlanWorkstreamNode[];
  nodesById: Map<string, PlanWorkstreamNode>;
  onOpenFull: (nodeId: string) => void;
  registerNode: (nodeId: string, element: HTMLElement | null) => void;
  selectedNodeId: string | null;
  snapshotEdges: PlanWorkstreamEdge[];
}) =>
  nodes.length === 0 ? null : (
    <div className='grid gap-2'>
      {nodes.map(node => (
        <GlobalBoardNodeCard
          key={node.id}
          breadcrumb={getNodeBreadcrumb(node.id, snapshotEdges, nodesById)}
          markdownContext={markdownContext}
          node={node}
          onOpenFull={onOpenFull}
          registerNode={registerNode}
          selected={node.id === selectedNodeId}
        />
      ))}
    </div>
  );

const GlobalAtlasBoard = ({
  columns,
  markdownContext,
  nodesById,
  onOpenFull,
  onShowHistoryChange,
  registerNode,
  selectedNodeId,
  showHistory,
  snapshotEdges,
}: {
  columns: Record<BoardColumnKey, PlanWorkstreamNode[]>;
  markdownContext: MarkdownRenderContext;
  nodesById: Map<string, PlanWorkstreamNode>;
  onOpenFull: (nodeId: string) => void;
  onShowHistoryChange: (showHistory: boolean) => void;
  registerNode: (nodeId: string, element: HTMLElement | null) => void;
  selectedNodeId: string | null;
  showHistory: boolean;
  snapshotEdges: PlanWorkstreamEdge[];
}) => (
  <section className='absolute inset-0 overflow-hidden bg-background/95 bg-[radial-gradient(circle_at_1px_1px,rgba(113,113,122,0.18)_1px,transparent_0)] [background-size:24px_24px]'>
    <button
      type='button'
      className='pointer-events-auto absolute right-4 top-4 z-10 h-10 rounded-lg border border-border/70 bg-background/78 px-3 text-xs font-medium text-muted-foreground shadow-lg backdrop-blur-xl transition-colors hover:border-primary/45 hover:text-foreground'
      onClick={() => onShowHistoryChange(!showHistory)}
    >
      {showHistory ? 'Hide history' : 'Show history'}
    </button>
    <div className='flex h-full min-h-0 flex-col px-4 pb-5 pt-40 sm:pt-36 lg:px-6 lg:pt-28'>
      <div className='min-h-0 flex-1 overflow-y-auto rounded-lg border border-border/60 bg-background/45 p-4 shadow-lg backdrop-blur-sm lg:overflow-hidden'>
        <div
          className={cn(
            'grid min-h-full gap-4 lg:h-full lg:min-h-0 lg:gap-0',
            showHistory ? 'lg:grid-cols-4' : 'lg:grid-cols-3',
          )}
        >
          {showHistory ? (
            <EvolutionBoardColumn
              count={columns.past.length}
              subtitle='Done plans and materialized shapes.'
              title='Past'
            >
              <GlobalBoardNodeList
                markdownContext={markdownContext}
                nodes={columns.past}
                nodesById={nodesById}
                onOpenFull={onOpenFull}
                registerNode={registerNode}
                selectedNodeId={selectedNodeId}
                snapshotEdges={snapshotEdges}
              />
            </EvolutionBoardColumn>
          ) : null}

          <EvolutionBoardColumn
            count={columns.now.length}
            subtitle='Active work and currently shaped items.'
            title='Now'
          >
            <GlobalBoardNodeList
              markdownContext={markdownContext}
              nodes={columns.now}
              nodesById={nodesById}
              onOpenFull={onOpenFull}
              registerNode={registerNode}
              selectedNodeId={selectedNodeId}
              snapshotEdges={snapshotEdges}
            />
          </EvolutionBoardColumn>

          <EvolutionBoardColumn
            count={columns.next.length}
            subtitle='Promoted next work.'
            title='Next'
          >
            <GlobalBoardNodeList
              markdownContext={markdownContext}
              nodes={columns.next}
              nodesById={nodesById}
              onOpenFull={onOpenFull}
              registerNode={registerNode}
              selectedNodeId={selectedNodeId}
              snapshotEdges={snapshotEdges}
            />
          </EvolutionBoardColumn>

          <EvolutionBoardColumn
            count={columns.later.length}
            subtitle='Later, backlog, research, and idea-shaped work.'
            title='Later'
          >
            <GlobalBoardNodeList
              markdownContext={markdownContext}
              nodes={columns.later}
              nodesById={nodesById}
              onOpenFull={onOpenFull}
              registerNode={registerNode}
              selectedNodeId={selectedNodeId}
              snapshotEdges={snapshotEdges}
            />
          </EvolutionBoardColumn>
        </div>
      </div>
    </div>
  </section>
);

const metadataLabel = (key: string) =>
  key
    .replaceAll('-', ' ')
    .replaceAll(/\s+/g, ' ')
    .trim()
    .replaceAll(/\b[a-z]/g, match => match.toUpperCase());

const metadataSectionLabel = (node: PlanWorkstreamNode) =>
  node.kind === 'plan' ? 'Plan shape' : 'Atlas metadata';

const parseMarkdownMetadataLines = (lines: string[]) => {
  const metadata = new Map<string, string | string[]>();
  let currentListKey: string | null = null;

  for (const line of lines) {
    const listItem = line.match(/^\s+-\s+(.+)$/);

    if (listItem && currentListKey) {
      const currentValue = metadata.get(currentListKey);
      const currentList = Array.isArray(currentValue) ? currentValue : [];
      metadata.set(currentListKey, [...currentList, listItem[1]?.trim() ?? '']);
      continue;
    }

    const keyValue = line.match(/^([A-Za-z][A-Za-z0-9\s-]*):(?:\s*(.*))?$/);

    if (!keyValue) {
      currentListKey = null;
      continue;
    }

    const key = keyValue[1]?.trim() ?? '';
    const rawValue = keyValue[2]?.trim() ?? '';
    const value = rawValue === '[]' ? [] : rawValue;
    currentListKey = key;
    metadata.set(key, value);
  }

  return [...metadata.entries()].map(([key, value]) => ({
    key,
    label: metadataLabel(key),
    value,
  }));
};

const stripMatchingTitle = (body: string, title: string) => {
  const lines = body.replaceAll('\r\n', '\n').split('\n');
  const firstContentLineIndex = lines.findIndex(line => line.trim());
  const firstContentLine = firstContentLineIndex >= 0 ? lines[firstContentLineIndex]?.trim() : '';
  const heading = firstContentLine?.match(/^#\s+(.+)$/)?.[1]?.trim();

  if (!heading || heading !== title) {
    return body.trim();
  }

  return lines
    .slice(0, firstContentLineIndex)
    .concat(lines.slice(firstContentLineIndex + 1))
    .join('\n')
    .trim();
};

const parseMarkdownDocument = (node: PlanWorkstreamNode): ParsedMarkdownDocument => {
  const markdown = node.markdown?.replaceAll('\r\n', '\n') ?? '';
  const frontmatter = markdown.match(/^---\n([\s\S]*?)\n---\n?/);

  if (frontmatter) {
    return {
      body: stripMatchingTitle(markdown.slice(frontmatter[0].length), node.title),
      metadata: parseMarkdownMetadataLines(frontmatter[1]?.split('\n') ?? []),
    };
  }

  const lines = markdown.split('\n');
  const titleLineIndex = lines.findIndex(line => /^#\s+/.test(line));
  let metadataStartIndex = titleLineIndex >= 0 ? titleLineIndex + 1 : 0;
  const metadataLines: string[] = [];
  let bodyStartIndex = metadataStartIndex;

  while (metadataStartIndex < lines.length && !(lines[metadataStartIndex] ?? '').trim()) {
    metadataStartIndex += 1;
  }

  for (let index = metadataStartIndex; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    const trimmed = line.trim();

    if (!trimmed) {
      bodyStartIndex = index + 1;
      break;
    }

    if (!/^([A-Za-z][A-Za-z0-9\s-]*):\s*(.+)$/.test(trimmed)) {
      bodyStartIndex = index;
      break;
    }

    metadataLines.push(line);
    bodyStartIndex = index + 1;
  }

  return {
    body: stripMatchingTitle(lines.slice(bodyStartIndex).join('\n'), node.title),
    metadata: parseMarkdownMetadataLines(metadataLines),
  };
};

const getMarkdownHeadingLabel = (content: string) =>
  content
    .replaceAll(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replaceAll(/[`*_~]/g, '')
    .replaceAll(/\s+/g, ' ')
    .trim();

const getMarkdownHeadingId = (lineIndex: number, content: string) => {
  const slug = getMarkdownHeadingLabel(content)
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/^-|-$/g, '');

  return `section-${lineIndex}-${slug || 'heading'}`;
};

const extractMarkdownSections = (body: string): MarkdownSection[] => {
  const sections: MarkdownSection[] = [];
  const lines = body.trim().split('\n');
  let insideCodeFence = false;

  lines.forEach((line, lineIndex) => {
    const trimmed = line.trim();

    if (trimmed.startsWith('```')) {
      insideCodeFence = !insideCodeFence;
      return;
    }

    if (insideCodeFence) {
      return;
    }

    const heading = trimmed.match(/^(#{2,4})\s+(.+)$/);

    if (!heading) {
      return;
    }

    const content = heading[2] ?? '';
    const label = getMarkdownHeadingLabel(content);

    if (!label) {
      return;
    }

    sections.push({
      id: getMarkdownHeadingId(lineIndex, content),
      label,
      level: heading[1]?.length ?? 2,
      lineIndex,
    });
  });

  return sections;
};

const getMarkdownSectionGroups = (
  sections: MarkdownSection[],
  node: PlanWorkstreamNode,
): MarkdownSectionGroup[] => {
  const groups: MarkdownSectionGroup[] = [];
  const planNumber = node.kind === 'plan' ? getPlanNumber(node) : null;
  const firstSection = sections[0];
  const skipFirstTitleSection =
    Boolean(planNumber) &&
    firstSection?.lineIndex === 0 &&
    firstSection.level <= 2 &&
    firstSection.label.toLowerCase().startsWith(planNumber ?? '');
  let activeGroup: MarkdownSectionGroup | null = null;
  let sawVisibleTopLevelSection = false;

  for (const section of sections) {
    if (skipFirstTitleSection && section.id === firstSection?.id) {
      continue;
    }

    const promoteOldPlanRoot =
      skipFirstTitleSection && !sawVisibleTopLevelSection && section.level === 3;
    const startsRootSection = section.level <= 2 || promoteOldPlanRoot || !activeGroup;

    if (startsRootSection) {
      activeGroup = { children: [], root: section };
      groups.push(activeGroup);

      if (section.level <= 2) {
        sawVisibleTopLevelSection = true;
      }

      continue;
    }

    activeGroup?.children.push(section);
  }

  return groups;
};

const semanticSignalKindPattern = /^(FUTURE|TENSION|QUESTION|DECISION|EVIDENCE)$/i;

const normalizeSemanticSignalKind = (value: string): SemanticSignalKind =>
  value.toLowerCase() as SemanticSignalKind;

const semanticSignalLabel = (kind: SemanticSignalKind) => {
  switch (kind) {
    case 'decision':
      return 'Decision';
    case 'evidence':
      return 'Evidence';
    case 'future':
      return 'Future';
    case 'question':
      return 'Question';
    case 'tension':
      return 'Tension';
  }
};

const semanticSignalClassName = (kind: SemanticSignalKind) => {
  switch (kind) {
    case 'decision':
      return 'border-emerald-300/35 bg-emerald-300/10 text-emerald-200';
    case 'evidence':
      return 'border-indigo-300/35 bg-indigo-300/10 text-indigo-200';
    case 'future':
      return 'border-sky-300/35 bg-sky-300/10 text-sky-200';
    case 'question':
      return 'border-violet-300/35 bg-violet-300/10 text-violet-200';
    case 'tension':
      return 'border-amber-300/35 bg-amber-300/10 text-amber-200';
  }
};

const extractAtlasReferenceIds = (text: string) => {
  const ids = new Set<string>();

  for (const match of text.matchAll(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g)) {
    const id = match[1]?.trim();

    if (id) {
      ids.add(id.replace(/^atlas:/, ''));
    }
  }

  for (const match of text.matchAll(/\batlas:([A-Za-z0-9._-]+)/g)) {
    const id = match[1]?.trim();

    if (id) {
      ids.add(id);
    }
  }

  return [...ids];
};

const parseSemanticSignalQuote = (
  sourceNode: PlanWorkstreamNode,
  quoteLines: string[],
  blockIndex: number,
): SemanticSignal[] => {
  const marker = quoteLines[0]?.trim().match(/^\[!(.+)\]$/);
  const kind = marker?.[1]?.match(semanticSignalKindPattern)?.[1];

  if (!kind) {
    return [];
  }

  const targetLines = quoteLines.filter(line => /^targets?:/i.test(line.trim()));
  const targetSemanticIds = targetLines.flatMap(extractAtlasReferenceIds);

  if (targetSemanticIds.length === 0) {
    return [];
  }

  const possibleLines: string[] = [];
  const bodyLines: string[] = [];

  for (const line of quoteLines.slice(1)) {
    const trimmed = line.trim();

    if (!trimmed || /^targets?:/i.test(trimmed)) {
      continue;
    }

    const possible = trimmed.match(/^possible:\s*(.+)$/i);

    if (possible?.[1]) {
      possibleLines.push(possible[1].trim());
      continue;
    }

    bodyLines.push(trimmed);
  }

  const normalizedKind = normalizeSemanticSignalKind(kind);
  const body = bodyLines.join(' ').trim();
  const possible = possibleLines.join(' ').trim() || undefined;

  return [...new Set(targetSemanticIds)].map(targetSemanticId => ({
    body,
    id: `${sourceNode.id}:${normalizedKind}:${targetSemanticId}:${blockIndex}`,
    kind: normalizedKind,
    possible,
    sourceNodeId: sourceNode.id,
    targetSemanticId,
  }));
};

const extractSemanticSignals = (sourceNode: PlanWorkstreamNode) => {
  if (!sourceNode.markdown) {
    return [];
  }

  const lines = parseMarkdownDocument(sourceNode).body.split('\n');
  const signals: SemanticSignal[] = [];
  let index = 0;
  let blockIndex = 0;

  while (index < lines.length) {
    const trimmed = (lines[index] ?? '').trim();

    if (!/^>\s?/.test(trimmed)) {
      index += 1;
      continue;
    }

    const quoteLines: string[] = [];

    while (index < lines.length && /^>\s?/.test((lines[index] ?? '').trim())) {
      quoteLines.push((lines[index] ?? '').trim().replace(/^>\s?/, ''));
      index += 1;
    }

    signals.push(...parseSemanticSignalQuote(sourceNode, quoteLines, blockIndex));
    blockIndex += 1;
  }

  return signals;
};

const codeLanguageAliases: Record<string, string> = {
  cjs: 'javascript',
  js: 'javascript',
  jsx: 'jsx',
  md: 'markdown',
  mermaid: 'mermaid',
  mjs: 'javascript',
  sh: 'bash',
  shell: 'bash',
  ts: 'typescript',
  tsx: 'tsx',
  yml: 'yaml',
  zsh: 'bash',
};

const normalizeCodeLanguage = (language?: string) => {
  const normalizedLanguage = language?.trim().toLowerCase();

  if (!normalizedLanguage) {
    return 'text';
  }

  return codeLanguageAliases[normalizedLanguage] ?? normalizedLanguage;
};

const escapeHtml = (text: string) =>
  text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

const plainCodeHtml = (code: string) => `<pre class="shiki"><code>${escapeHtml(code)}</code></pre>`;

const normalizeMarkdownPath = (value: string) => {
  const parts: string[] = [];

  for (const part of value.replaceAll('\\', '/').split('/')) {
    if (!part || part === '.') {
      continue;
    }

    if (part === '..') {
      parts.pop();
      continue;
    }

    parts.push(part);
  }

  return parts.join('/');
};

const resolveMarkdownLinkNode = (
  sourceNode: PlanWorkstreamNode,
  href: string,
  nodesByPath: Map<string, PlanWorkstreamNode>,
  nodesBySemanticId: Map<string, PlanWorkstreamNode>,
) => {
  const cleanHref = href.split('#')[0]?.trim();

  if (!cleanHref || /^https?:\/\//.test(cleanHref)) {
    return null;
  }

  if (cleanHref.startsWith('atlas:')) {
    return nodesBySemanticId.get(cleanHref.slice('atlas:'.length)) ?? null;
  }

  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(cleanHref)) {
    return nodesByPath.get(cleanHref) ?? null;
  }

  if (!cleanHref.endsWith('.md')) {
    return null;
  }

  const sourceDirectory =
    (sourceNode.sourceFilePath ?? sourceNode.path)?.split('/').slice(0, -1).join('/') ?? '';
  const targetPath = normalizeMarkdownPath(
    cleanHref.startsWith('/') ? cleanHref.slice(1) : `${sourceDirectory}/${cleanHref}`,
  );

  return nodesByPath.get(targetPath) ?? null;
};

const resolveAtlasReferenceNode = (
  reference: string,
  nodesBySemanticId: Map<string, PlanWorkstreamNode>,
) => {
  const cleanReference = reference.replace(/^atlas:/, '').trim();

  return cleanReference ? (nodesBySemanticId.get(cleanReference) ?? null) : null;
};

const labelFromAtlasReference = (reference: string) =>
  (() => {
    const parts = reference.replace(/^atlas:/, '').split('.');
    const lastPart = parts[parts.length - 1];

    return lastPart
      ? lastPart
          .split('-')
          .map(part => part.charAt(0).toUpperCase() + part.slice(1))
          .join(' ')
      : reference;
  })();

const HighlightedCodeBlock = ({ code, language }: { code: string; language?: string }) => {
  const mappedLanguage = useMemo(() => normalizeCodeLanguage(language), [language]);
  const languageLabel = (language || mappedLanguage).toUpperCase();
  const [renderState, setRenderState] = useState<CodeRenderState>(() => ({
    highlighted: false,
    html: plainCodeHtml(code),
  }));

  useEffect(() => {
    let cancelled = false;
    setRenderState({ highlighted: false, html: plainCodeHtml(code) });

    if (mappedLanguage === 'text' || mappedLanguage === 'mermaid') {
      return () => {
        cancelled = true;
      };
    }

    const renderHighlightedCode = async () => {
      try {
        const { codeToHtml } = await import('shiki');
        const html = await codeToHtml(code, {
          defaultColor: false,
          lang: mappedLanguage as Parameters<typeof codeToHtml>[1]['lang'],
          themes: {
            dark: 'github-dark',
            light: 'github-light',
          },
        });

        if (!cancelled) {
          setRenderState({ highlighted: true, html });
        }
      } catch {
        if (!cancelled) {
          setRenderState({ highlighted: false, html: plainCodeHtml(code) });
        }
      }
    };

    void renderHighlightedCode();

    return () => {
      cancelled = true;
    };
  }, [code, mappedLanguage]);

  if (mappedLanguage === 'mermaid') {
    return (
      <div className='my-7 rounded-lg border border-border/70 bg-background/50 p-4 [&_figure]:my-0'>
        <MermaidDiagram code={code} />
      </div>
    );
  }

  return (
    <figure className='my-7'>
      <div className='relative overflow-hidden rounded-lg border border-border/80 bg-background/80 shadow-inner'>
        <div className='pointer-events-none absolute right-3 top-3 z-10 rounded border border-border/70 bg-card/85 px-2 py-0.5 font-mono text-[10px] uppercase tracking-normal text-muted-foreground backdrop-blur'>
          {languageLabel}
        </div>
        <div
          className={cn(
            'overflow-x-auto text-[13px] leading-6',
            '[&_.shiki]:!m-0 [&_.shiki]:!bg-transparent [&_.shiki]:p-4 [&_.shiki]:pr-20',
            '[&_.shiki_code]:font-mono [&_.line]:min-h-[1.45rem]',
            !renderState.highlighted && 'text-muted-foreground',
          )}
          dangerouslySetInnerHTML={{ __html: renderState.html }}
        />
      </div>
    </figure>
  );
};

const InlinePlanStatusBadge = ({ node }: { node: PlanWorkstreamNode }) =>
  node.kind === 'plan' ? (
    <span className='inline-flex w-[4.75rem] shrink-0 items-center gap-1.5 font-mono text-[0.62em] font-normal leading-none text-muted-foreground no-underline'>
      <span className={cn('size-1.5 rounded-full', statusDotClassName(node.statusGroup))} />
      <span>{getNodeStatusLabel(node)}</span>
    </span>
  ) : null;

const renderMarkdownInline = (text: string, context: MarkdownRenderContext) => {
  const nodes: ReactNode[] = [];
  const pattern =
    /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]|\[([^\]]+)\]\(([^)]+)\)|`([^`]+)`|(\*\*|__)([\s\S]+?)\6/g;
  let lastIndex = 0;

  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;

    if (index > lastIndex) {
      nodes.push(text.slice(lastIndex, index));
    }

    if (match[1]) {
      const reference = match[1].trim();
      const label = match[2]?.trim() || labelFromAtlasReference(reference);
      const internalNode = resolveAtlasReferenceNode(reference, context.nodesBySemanticId);

      nodes.push(
        internalNode ? (
          <button
            key={`wiki-${index}`}
            type='button'
            className='inline cursor-pointer rounded-sm text-left font-medium text-sky-300 underline decoration-sky-300/45 underline-offset-4 transition-colors hover:text-sky-200 hover:decoration-sky-200'
            title={internalNode.semanticId ?? internalNode.path}
            onClick={() => context.onOpenFull(internalNode.id)}
          >
            {label}
          </button>
        ) : (
          <span
            key={`wiki-${index}`}
            className='rounded-sm border border-dashed border-sky-300/35 px-1 text-sky-300'
            title={reference}
          >
            {label}
          </span>
        ),
      );
    } else if (match[5]) {
      nodes.push(
        <code
          key={`code-${index}`}
          className='rounded border border-border/70 bg-background/70 px-1 py-0.5 font-mono text-[0.9em] text-foreground'
        >
          {match[5]}
        </code>,
      );
    } else if (match[7]) {
      nodes.push(
        <strong key={`strong-${index}`} className='font-semibold text-foreground'>
          {renderMarkdownInline(match[7], context)}
        </strong>,
      );
    } else {
      const label = match[3] ?? '';
      const href = match[4] ?? '';
      const isExternal = /^https?:\/\//.test(href);
      const internalNode = isExternal
        ? null
        : resolveMarkdownLinkNode(
            context.sourceNode,
            href,
            context.nodesByPath,
            context.nodesBySemanticId,
          );
      const displayLabel = label.replace(/^`|`$/g, '');

      nodes.push(
        isExternal ? (
          <a
            key={`link-${index}`}
            className='text-sky-300 underline decoration-sky-300/35 underline-offset-4'
            href={href}
            rel='noreferrer'
            target='_blank'
          >
            {label}
          </a>
        ) : internalNode ? (
          <button
            key={`link-${index}`}
            type='button'
            className='group inline-flex cursor-pointer items-baseline gap-2 rounded-sm align-baseline text-left font-medium transition-colors'
            title={internalNode.path ?? internalNode.semanticId}
            onClick={() => context.onOpenFull(internalNode.id)}
          >
            <InlinePlanStatusBadge node={internalNode} />
            <span className='text-sky-300 underline decoration-sky-300/45 underline-offset-4 transition-colors group-hover:text-sky-200 group-hover:decoration-sky-200'>
              {displayLabel}
            </span>
          </button>
        ) : (
          <span
            key={`link-${index}`}
            className='text-sky-300 underline decoration-sky-300/35 underline-offset-4'
            title={href}
          >
            {label}
          </span>
        ),
      );
    }

    lastIndex = index + match[0].length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
};

const ShapeContentSummary = ({
  className,
  context,
  text,
}: {
  className?: string;
  context: MarkdownRenderContext;
  text: string;
}) => (
  <p className={cn('text-muted-foreground', className)}>{renderMarkdownInline(text, context)}</p>
);

const isListLine = (line: string) => /^\s*[-*]\s+/.test(line) || /^\s*\d+\.\s+/.test(line);

const parseChecklistLine = (line: string) => {
  const match = line.match(/^\s*(?:(?:[-*]|\d+\.)\s+)?\[([ xX])\]\s+(.+)$/);

  if (!match) {
    return null;
  }

  return {
    checked: match[1]?.toLowerCase() === 'x',
    text: match[2]?.trim() ?? '',
  };
};

const isIndentedListContinuation = (line: string) =>
  /^\s+/.test(line) && Boolean(line.trim()) && !isListLine(line) && !parseChecklistLine(line);

const alertLabel = (value: string) => {
  switch (value.toUpperCase()) {
    case 'CAUTION':
      return 'Caution';
    case 'DECISION':
      return 'Decision';
    case 'EVIDENCE':
      return 'Evidence';
    case 'FUTURE':
      return 'Future';
    case 'IMPORTANT':
      return 'Important';
    case 'QUESTION':
      return 'Question';
    case 'TENSION':
      return 'Tension';
    case 'TIP':
      return 'Tip';
    case 'WARNING':
      return 'Warning';
    case 'NOTE':
    default:
      return 'Note';
  }
};

const alertClassName = (value: string) => {
  switch (value.toUpperCase()) {
    case 'CAUTION':
    case 'TENSION':
    case 'WARNING':
      return 'border-amber-300/30 bg-amber-400/10';
    case 'DECISION':
      return 'border-emerald-300/30 bg-emerald-400/10';
    case 'EVIDENCE':
      return 'border-indigo-300/30 bg-indigo-400/10';
    case 'FUTURE':
      return 'border-sky-300/30 bg-sky-400/10';
    case 'QUESTION':
      return 'border-violet-300/30 bg-violet-400/10';
    case 'IMPORTANT':
    case 'TIP':
    case 'NOTE':
    default:
      return 'border-sky-300/25 bg-sky-400/10';
  }
};

const splitMarkdownTableRow = (line: string) => {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  const cells: string[] = [];
  let current = '';
  let escaped = false;
  let insideCode = false;

  for (const character of trimmed) {
    if (escaped) {
      current += character;
      escaped = false;
      continue;
    }

    if (character === '\\') {
      current += character;
      escaped = true;
      continue;
    }

    if (character === '`') {
      insideCode = !insideCode;
      current += character;
      continue;
    }

    if (character === '|' && !insideCode) {
      cells.push(current.trim());
      current = '';
      continue;
    }

    current += character;
  }

  cells.push(current.trim());

  return cells;
};

const isMarkdownTableRow = (line: string) => /^\s*\|.*\|\s*$/.test(line);

const isMarkdownTableSeparator = (line: string) => {
  if (!isMarkdownTableRow(line)) {
    return false;
  }

  const cells = splitMarkdownTableRow(line);

  return cells.length > 1 && cells.every(cell => /^:?-{3,}:?$/.test(cell.trim()));
};

const isMarkdownTableStart = (lines: string[], index: number) =>
  isMarkdownTableRow(lines[index] ?? '') && isMarkdownTableSeparator(lines[index + 1] ?? '');

const renderMarkdownBody = (body: string, context: MarkdownRenderContext) => {
  const lines = body.trim().split('\n');
  const blocks: ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index] ?? '';
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    if (trimmed.startsWith('```')) {
      const language = trimmed.slice(3).trim().split(/\s+/)[0] || undefined;
      const codeLines: string[] = [];
      index += 1;

      while (index < lines.length && !(lines[index] ?? '').trim().startsWith('```')) {
        codeLines.push(lines[index] ?? '');
        index += 1;
      }

      index += 1;
      blocks.push(
        <HighlightedCodeBlock
          key={`code-block-${index}`}
          code={codeLines.join('\n')}
          language={language}
        />,
      );
      continue;
    }

    const heading = trimmed.match(/^(#{2,4})\s+(.+)$/);

    if (heading) {
      const level = heading[1]?.length ?? 2;
      const content = heading[2] ?? '';
      const HeadingTag = level === 2 ? 'h3' : 'h4';

      blocks.push(
        <HeadingTag
          key={`heading-${index}`}
          id={getMarkdownHeadingId(index, content)}
          className={cn(
            'scroll-mt-6',
            'font-semibold tracking-tight text-foreground',
            level === 2 ? 'mt-7 text-lg' : 'mt-5 text-sm',
          )}
        >
          {renderMarkdownInline(content, context)}
        </HeadingTag>,
      );
      index += 1;
      continue;
    }

    if (/^>\s?/.test(trimmed)) {
      const quoteLines: string[] = [];

      while (index < lines.length && /^>\s?/.test((lines[index] ?? '').trim())) {
        quoteLines.push((lines[index] ?? '').trim().replace(/^>\s?/, ''));
        index += 1;
      }

      const alert = quoteLines[0]
        ?.trim()
        .match(
          /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION|FUTURE|TENSION|QUESTION|DECISION|EVIDENCE)\]$/i,
        );

      if (alert) {
        const label = alertLabel(alert[1] ?? 'NOTE');
        const content = quoteLines.slice(1).join(' ').trim();

        blocks.push(
          <aside
            key={`alert-${index}`}
            className={cn(
              'rounded-md border px-4 py-3 text-sm leading-6 text-muted-foreground',
              alertClassName(alert[1] ?? 'NOTE'),
            )}
          >
            <div className='mb-1.5 flex items-center gap-2 font-mono text-xs uppercase text-sky-200'>
              <Info className='size-3.5' />
              {label}
            </div>
            <div>{renderMarkdownInline(content, context)}</div>
          </aside>,
        );
        continue;
      }

      blocks.push(
        <blockquote
          key={`quote-${index}`}
          className='border-l-2 border-sky-400/60 bg-background/45 px-3 py-2 text-sm leading-6 text-muted-foreground'
        >
          {renderMarkdownInline(quoteLines.join(' '), context)}
        </blockquote>,
      );
      continue;
    }

    const checklistItem = parseChecklistLine(line);

    if (checklistItem) {
      const items = [checklistItem];
      index += 1;

      while (index < lines.length) {
        const nextItem = parseChecklistLine(lines[index] ?? '');

        if (nextItem) {
          items.push(nextItem);
          index += 1;
          continue;
        }

        if (isIndentedListContinuation(lines[index] ?? '')) {
          const currentItem = items.at(-1);

          if (currentItem) {
            currentItem.text = `${currentItem.text} ${(lines[index] ?? '').trim()}`;
          }

          index += 1;
          continue;
        }

        break;
      }

      blocks.push(
        <div
          key={`checklist-${index}`}
          className='grid gap-2.5 rounded-md border border-border/70 bg-background/35 px-4 py-3'
        >
          {items.map((item, itemIndex) => (
            <div
              key={`${item.text}-${itemIndex}`}
              className='grid grid-cols-[1.1rem_1fr] items-start gap-3 text-[15px] text-muted-foreground'
            >
              <span
                aria-hidden='true'
                className={cn(
                  'mt-1 grid size-4 place-items-center rounded border transition-colors',
                  item.checked
                    ? 'border-sky-300 bg-sky-300/15 text-sky-200'
                    : 'border-sky-300/70 bg-background/70 text-transparent',
                )}
              >
                <Check className='size-3' />
              </span>
              <span className='min-w-0 leading-7'>{renderMarkdownInline(item.text, context)}</span>
            </div>
          ))}
        </div>,
      );
      continue;
    }

    if (isMarkdownTableStart(lines, index)) {
      const headerCells = splitMarkdownTableRow(line);
      const columnCount = headerCells.length;
      const rows: string[][] = [];
      index += 2;

      while (index < lines.length && isMarkdownTableRow(lines[index] ?? '')) {
        rows.push(splitMarkdownTableRow(lines[index] ?? ''));
        index += 1;
      }

      blocks.push(
        <div
          key={`table-${index}`}
          className='my-6 overflow-hidden rounded-lg border border-border/75 bg-background/40'
        >
          <div className='overflow-x-auto'>
            <table className='min-w-full border-collapse text-left text-sm'>
              <thead className='bg-muted/45'>
                <tr>
                  {headerCells.map((cell, cellIndex) => (
                    <th
                      key={`${cell}-${cellIndex}`}
                      className='whitespace-nowrap border-b border-r border-border/65 px-3 py-2.5 font-mono text-[11px] font-semibold uppercase text-muted-foreground last:border-r-0'
                      scope='col'
                    >
                      {renderMarkdownInline(cell, context)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIndex) => (
                  <tr
                    key={`row-${rowIndex}`}
                    className='border-b border-border/55 last:border-b-0 even:bg-muted/10'
                  >
                    {Array.from({ length: columnCount }).map((_, cellIndex) => (
                      <td
                        key={`${rowIndex}-${cellIndex}`}
                        className='max-w-[24rem] align-top border-r border-border/45 px-3 py-2.5 leading-6 text-muted-foreground last:border-r-0'
                      >
                        {renderMarkdownInline(row[cellIndex] ?? '', context)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>,
      );
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];

      while (index < lines.length) {
        const nextLine = lines[index] ?? '';

        if (/^\s*[-*]\s+/.test(nextLine)) {
          items.push(nextLine.replace(/^\s*[-*]\s+/, '').trim());
          index += 1;
          continue;
        }

        if (items.length > 0 && isIndentedListContinuation(nextLine)) {
          const lastIndex = items.length - 1;
          items[lastIndex] = `${items[lastIndex]} ${nextLine.trim()}`;
          index += 1;
          continue;
        }

        break;
      }

      blocks.push(
        <ul
          key={`list-${index}`}
          className='grid list-disc gap-2.5 pl-9 text-[15px] text-muted-foreground marker:font-bold marker:text-sky-300'
        >
          {items.map((item, itemIndex) => (
            <li key={`${item}-${itemIndex}`} className='pl-2 leading-7'>
              {renderMarkdownInline(item, context)}
            </li>
          ))}
        </ul>,
      );
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const items: Array<{ marker: number; text: string }> = [];

      while (index < lines.length) {
        const nextLine = lines[index] ?? '';
        const item = nextLine.match(/^\s*(\d+)\.\s+(.+)$/);

        if (item) {
          items.push({ marker: Number(item[1]), text: item[2]?.trim() ?? '' });
          index += 1;
          continue;
        }

        if (items.length > 0 && isIndentedListContinuation(nextLine)) {
          const lastItem = items.at(-1);

          if (lastItem) {
            lastItem.text = `${lastItem.text} ${nextLine.trim()}`;
          }

          index += 1;
          continue;
        }

        break;
      }

      blocks.push(
        <ol
          key={`ordered-list-${index}`}
          className='grid list-decimal gap-2.5 pl-9 text-[15px] text-muted-foreground marker:font-mono marker:font-semibold marker:text-sky-300'
          start={items[0]?.marker ?? 1}
        >
          {items.map((item, itemIndex) => (
            <li key={`${item.text}-${itemIndex}`} className='pl-2 leading-7'>
              {renderMarkdownInline(item.text, context)}
            </li>
          ))}
        </ol>,
      );
      continue;
    }

    if (/^---+$/.test(trimmed)) {
      blocks.push(<hr key={`rule-${index}`} className='border-border/70' />);
      index += 1;
      continue;
    }

    const paragraphLines = [trimmed];
    index += 1;

    while (
      index < lines.length &&
      (lines[index] ?? '').trim() &&
      !/^(#{2,4})\s+/.test((lines[index] ?? '').trim()) &&
      !/^>\s?/.test((lines[index] ?? '').trim()) &&
      !isListLine(lines[index] ?? '') &&
      !parseChecklistLine(lines[index] ?? '') &&
      !isMarkdownTableStart(lines, index) &&
      !(lines[index] ?? '').trim().startsWith('```') &&
      !/^---+$/.test((lines[index] ?? '').trim())
    ) {
      paragraphLines.push((lines[index] ?? '').trim());
      index += 1;
    }

    blocks.push(
      <p key={`paragraph-${index}`} className='text-[15px] leading-7 text-muted-foreground'>
        {renderMarkdownInline(paragraphLines.join(' '), context)}
      </p>,
    );
  }

  return blocks.length > 0 ? blocks : <p className='text-sm text-muted-foreground'>No content.</p>;
};

const scrollToMarkdownSection = (sectionId: string) => {
  globalThis.document?.getElementById(sectionId)?.scrollIntoView({
    behavior: 'smooth',
    block: 'start',
  });
};

const MarkdownSectionIndex = ({ groups }: { groups: MarkdownSectionGroup[] }) => {
  const groupKey = groups.map(group => group.root.id).join('|');
  const [expandedGroupIds, setExpandedGroupIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setExpandedGroupIds(new Set());
  }, [groupKey]);

  if (groups.length === 0) {
    return null;
  }

  const toggleGroup = (groupId: string) => {
    setExpandedGroupIds(previous => {
      const next = new Set(previous);

      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }

      return next;
    });
  };

  return (
    <nav
      aria-label='Document sections'
      className='sticky top-0 hidden max-h-[calc(88vh-13rem)] min-w-0 self-start overflow-y-auto border-l border-border/65 bg-card/85 pl-4 text-xs backdrop-blur-sm xl:block'
    >
      <div className='font-mono text-[10px] uppercase tracking-wide text-muted-foreground/70'>
        Sections
      </div>
      <ol className='mt-3 grid gap-1.5'>
        {groups.map(group => {
          const expanded = expandedGroupIds.has(group.root.id);
          const hasChildren = group.children.length > 0;

          return (
            <li key={group.root.id} className='min-w-0'>
              <div className='flex min-w-0 items-center gap-1.5'>
                {hasChildren ? (
                  <button
                    type='button'
                    aria-expanded={expanded}
                    aria-label={`${expanded ? 'Collapse' : 'Expand'} ${group.root.label}`}
                    className='grid size-4 shrink-0 place-items-center rounded border border-border/60 text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground'
                    onClick={() => toggleGroup(group.root.id)}
                  >
                    {expanded ? <Minus className='size-2.5' /> : <Plus className='size-2.5' />}
                  </button>
                ) : (
                  <span className='size-4 shrink-0' />
                )}
                <button
                  type='button'
                  className='min-w-0 truncate text-left font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline'
                  title={group.root.label}
                  onClick={() => scrollToMarkdownSection(group.root.id)}
                >
                  {group.root.label}
                </button>
              </div>

              {expanded && hasChildren ? (
                <ol className='mt-1.5 grid gap-1.5 pl-5'>
                  {group.children.map(section => (
                    <li key={section.id} className={cn('min-w-0', section.level > 3 && 'pl-3')}>
                      <button
                        type='button'
                        className='block max-w-full truncate text-left text-muted-foreground/80 underline-offset-4 transition-colors hover:text-foreground hover:underline'
                        title={section.label}
                        onClick={() => scrollToMarkdownSection(section.id)}
                      >
                        {section.label}
                      </button>
                    </li>
                  ))}
                </ol>
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

const FullMarkdownModal = ({
  activeTab,
  edges,
  evidence,
  nodesById,
  nodesByPath,
  nodesBySemanticId,
  node,
  navigationBackNode,
  onActiveTabChange,
  onClose,
  onNavigateBack,
  onOpenFull,
  semanticSignals,
}: {
  activeTab: FullMarkdownModalTab;
  edges: PlanWorkstreamEdge[];
  evidence: PlanWorkstreamEvidence[];
  nodesById: Map<string, PlanWorkstreamNode>;
  nodesByPath: Map<string, PlanWorkstreamNode>;
  nodesBySemanticId: Map<string, PlanWorkstreamNode>;
  node: PlanWorkstreamNode;
  navigationBackNode: PlanWorkstreamNode | null;
  onActiveTabChange: (tab: FullMarkdownModalTab) => void;
  onClose: () => void;
  onNavigateBack: () => void;
  onOpenFull: (nodeId: string) => void;
  semanticSignals: SemanticSignal[];
}) => {
  const parsedDocument = useMemo(() => parseMarkdownDocument(node), [node]);
  const markdownSections = useMemo(
    () => extractMarkdownSections(parsedDocument.body),
    [parsedDocument.body],
  );
  const markdownSectionGroups = useMemo(
    () => getMarkdownSectionGroups(markdownSections, node),
    [markdownSections, node],
  );
  const markdownContext = useMemo<MarkdownRenderContext>(
    () => ({
      nodesByPath,
      nodesBySemanticId,
      onOpenFull,
      sourceNode: node,
    }),
    [node, nodesByPath, nodesBySemanticId, onOpenFull],
  );
  const futureSignals = semanticSignals.filter(
    signal => signal.kind === 'future' || signal.kind === 'question',
  );
  const tensionSignals = semanticSignals.filter(signal => signal.kind === 'tension');
  const evolutionSignals = semanticSignals.filter(
    signal => signal.kind === 'decision' || signal.kind === 'evidence',
  );
  const evolutionEntries = useMemo(
    () => getEvolutionEntries(node.id, edges, nodesById),
    [edges, node.id, nodesById],
  );
  const nodeEvidence = useMemo(
    () => evidence.filter(binding => binding.targetNodeId === node.id),
    [evidence, node.id],
  );
  const incoming = useMemo(() => edges.filter(edge => edge.to === node.id), [edges, node.id]);
  const outgoing = useMemo(() => edges.filter(edge => edge.from === node.id), [edges, node.id]);
  const { hierarchy, relations } = useMemo(
    () => mergeDrawerRelations(node.id, incoming, outgoing),
    [incoming, node.id, outgoing],
  );
  const contextHierarchy = useMemo(() => getContextHierarchyRelations(hierarchy), [hierarchy]);
  const breadcrumb = useMemo(
    () => getNodeBreadcrumb(node.id, edges, nodesById),
    [edges, node.id, nodesById],
  );
  const pastEntries = evolutionEntries.filter(entry => entry.stage === 'past');
  const currentEntries = evolutionEntries.filter(entry => entry.stage === 'now');
  const nextEntries = evolutionEntries.filter(entry => entry.node.statusGroup === 'next');
  const laterEntries = evolutionEntries.filter(
    entry => entry.stage === 'future' && !nextEntries.includes(entry),
  );
  const hasEvolutionContent =
    evolutionEntries.length > 0 ||
    nodeEvidence.length > 0 ||
    futureSignals.length > 0 ||
    tensionSignals.length > 0 ||
    evolutionSignals.length > 0;
  const hasContextContent =
    breadcrumb.length > 0 || contextHierarchy.length > 0 || relations.length > 0;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    globalThis.addEventListener('keydown', handleKeyDown);

    return () => globalThis.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      aria-modal='true'
      className='fixed inset-0 z-[80] bg-background/55 backdrop-blur-md'
      role='dialog'
      onClick={onClose}
    >
      <div
        className='absolute left-1/2 top-1/2 flex h-[min(88vh,920px)] w-[min(1180px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border border-border/80 bg-card/95 shadow-2xl'
        onClick={event => event.stopPropagation()}
      >
        <div className='flex items-start gap-4 border-b border-border/70 px-5 py-4'>
          <div className='min-w-0 flex-1'>
            <div className='flex flex-wrap items-center gap-2'>
              <span className={cn('size-2 rounded-full', statusDotClassName(node.statusGroup))} />
              <span className='font-mono text-xs uppercase text-muted-foreground'>{node.kind}</span>
              <span className='font-mono text-xs text-muted-foreground'>{node.status}</span>
            </div>
            {breadcrumb.length > 0 ? (
              <div className='mt-2 flex min-w-0 flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground'>
                {breadcrumb.map((crumb, crumbIndex) => (
                  <Fragment key={crumb.id}>
                    {crumbIndex > 0 ? <span className='text-muted-foreground/60'>/</span> : null}
                    <button
                      type='button'
                      className='max-w-[180px] truncate rounded-sm underline-offset-4 transition-colors hover:text-foreground hover:underline'
                      title={crumb.path ?? crumb.semanticId}
                      onClick={() => onOpenFull(crumb.id)}
                    >
                      {crumb.shortTitle}
                    </button>
                  </Fragment>
                ))}
              </div>
            ) : null}
            <div className='mt-2 flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2'>
              <h2 className='min-w-0 flex-[1_1_18rem] text-2xl font-semibold leading-tight tracking-tight'>
                {node.shortTitle}
              </h2>
              <nav aria-label='Detail sections' className='ml-auto flex shrink-0 gap-1'>
                {(
                  ['overview', 'evolution', 'context', 'source'] satisfies FullMarkdownModalTab[]
                ).map(tab => (
                  <button
                    key={tab}
                    type='button'
                    className={cn(
                      'rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors',
                      activeTab === tab
                        ? 'bg-primary/12 text-foreground'
                        : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                    )}
                    onClick={() => onActiveTabChange(tab)}
                  >
                    {tab}
                  </button>
                ))}
              </nav>
            </div>
          </div>
          <div className='flex shrink-0 items-center gap-2'>
            {navigationBackNode ? (
              <button
                type='button'
                className='inline-flex h-9 max-w-[13rem] items-center gap-2 rounded-md border border-border/70 bg-background/55 px-2.5 text-xs font-medium text-muted-foreground shadow-sm transition-colors hover:border-primary/45 hover:bg-primary/10 hover:text-foreground'
                title={`Back to ${navigationBackNode.shortTitle}`}
                onClick={onNavigateBack}
              >
                <ArrowLeft className='size-4 shrink-0' />
                <span className='min-w-0 truncate'>{navigationBackNode.shortTitle}</span>
              </button>
            ) : null}
            <IconButton label='Close full detail' onClick={onClose}>
              <X className='size-4' />
            </IconButton>
          </div>
        </div>

        <div
          className={cn(
            'min-h-0 flex-1 px-6 py-6 sm:px-8 lg:px-10',
            activeTab === 'evolution' ? 'overflow-y-auto lg:overflow-hidden' : 'overflow-y-auto',
          )}
        >
          {activeTab === 'overview' ? (
            <div className='grid min-w-0 gap-6 px-1 sm:px-2 xl:grid-cols-[minmax(0,1fr)_12rem]'>
              <article className='grid min-w-0 max-w-full gap-5 overflow-hidden break-words xl:pr-2 [&>*]:min-w-0 [&>*]:max-w-full'>
                {renderMarkdownBody(parsedDocument.body, markdownContext)}
              </article>
              <MarkdownSectionIndex groups={markdownSectionGroups} />
            </div>
          ) : null}

          {activeTab === 'evolution' ? (
            <div className='min-h-0 px-1 sm:px-2 lg:h-full'>
              {hasEvolutionContent ? (
                <div className='flex min-h-0 flex-col gap-6 lg:h-full'>
                  <PullRequestEvidenceSection evidence={nodeEvidence} />

                  <div className='grid min-h-0 flex-1 gap-4 lg:grid-cols-4 lg:gap-0'>
                    <EvolutionBoardColumn
                      count={pastEntries.length + evolutionSignals.length}
                      subtitle='Materialized shapes and decisions that explain how this shape arrived here.'
                      title='Past'
                    >
                      <EvolutionEntryList
                        entries={pastEntries}
                        markdownContext={markdownContext}
                        onOpenFull={onOpenFull}
                      />
                      <SemanticSignalList
                        markdownContext={markdownContext}
                        nodesById={nodesById}
                        onOpenFull={onOpenFull}
                        signals={evolutionSignals}
                      />
                    </EvolutionBoardColumn>

                    <EvolutionBoardColumn
                      count={currentEntries.length + tensionSignals.length}
                      subtitle='Active work, live sub-shapes, and current pressure on the shape.'
                      title='Now'
                    >
                      <EvolutionEntryList
                        entries={currentEntries}
                        markdownContext={markdownContext}
                        onOpenFull={onOpenFull}
                      />
                      <SemanticSignalList
                        markdownContext={markdownContext}
                        nodesById={nodesById}
                        onOpenFull={onOpenFull}
                        signals={tensionSignals}
                      />
                    </EvolutionBoardColumn>

                    <EvolutionBoardColumn
                      count={nextEntries.length}
                      subtitle='Promoted branches that look like the next concrete work.'
                      title='Next'
                    >
                      <EvolutionEntryList
                        entries={nextEntries}
                        markdownContext={markdownContext}
                        onOpenFull={onOpenFull}
                      />
                    </EvolutionBoardColumn>

                    <EvolutionBoardColumn
                      count={laterEntries.length + futureSignals.length}
                      subtitle='Ideas, possibilities, questions, and not-yet-grounded branches.'
                      title='Later'
                    >
                      <EvolutionEntryList
                        entries={laterEntries}
                        markdownContext={markdownContext}
                        onOpenFull={onOpenFull}
                      />
                      <SemanticSignalList
                        markdownContext={markdownContext}
                        nodesById={nodesById}
                        onOpenFull={onOpenFull}
                        signals={futureSignals}
                      />
                    </EvolutionBoardColumn>
                  </div>
                </div>
              ) : (
                <p className='text-sm leading-6 text-muted-foreground'>
                  No local evolution yet. Child shapes, shaping work, and targeted semantic signals
                  will appear here as this shape gets developed.
                </p>
              )}
            </div>
          ) : null}

          {activeTab === 'context' ? (
            <div className='grid gap-6 px-1 sm:px-2'>
              {hasContextContent ? (
                <>
                  {breadcrumb.length > 0 ? (
                    <section className='grid gap-2'>
                      <h3 className='font-mono text-xs uppercase text-muted-foreground'>Path</h3>
                      <div className='flex flex-wrap items-center gap-2'>
                        {breadcrumb.map((crumb, crumbIndex) => (
                          <Fragment key={crumb.id}>
                            {crumbIndex > 0 ? (
                              <span className='text-xs text-muted-foreground/50'>/</span>
                            ) : null}
                            <button
                              type='button'
                              className='inline-flex max-w-full items-center rounded-md border border-border/70 bg-background/65 px-2.5 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground'
                              title={crumb.path ?? crumb.semanticId}
                              onClick={() => onOpenFull(crumb.id)}
                            >
                              <span className='truncate'>{crumb.shortTitle}</span>
                            </button>
                          </Fragment>
                        ))}
                      </div>
                    </section>
                  ) : null}

                  {contextHierarchy.length > 0 ? (
                    <section className='grid gap-2'>
                      <h3 className='font-mono text-xs uppercase text-muted-foreground'>
                        Structure Context
                      </h3>
                      <RelationList
                        nodesById={nodesById}
                        onSelect={onOpenFull}
                        relations={contextHierarchy}
                      />
                    </section>
                  ) : null}

                  {relations.length > 0 ? (
                    <section className='grid gap-2'>
                      <h3 className='font-mono text-xs uppercase text-muted-foreground'>
                        Relations
                      </h3>
                      <RelationList
                        nodesById={nodesById}
                        onSelect={onOpenFull}
                        relations={relations}
                      />
                    </section>
                  ) : null}
                </>
              ) : (
                <p className='text-sm leading-6 text-muted-foreground'>
                  No broader context links yet. Parents, support links, lateral relations, and
                  nearby branches will appear here.
                </p>
              )}
            </div>
          ) : null}

          {activeTab === 'source' ? (
            parsedDocument.metadata.length > 0 ? (
              <section className='rounded-md border border-border/70 bg-background/35 p-4'>
                <h3 className='font-mono text-xs uppercase text-muted-foreground'>
                  {metadataSectionLabel(node)}
                </h3>
                <dl className='mt-3 grid gap-3 sm:grid-cols-2'>
                  {parsedDocument.metadata.map(item => (
                    <div key={item.key} className='min-w-0'>
                      <dt className='font-mono text-[10px] uppercase text-muted-foreground/70'>
                        {item.label}
                      </dt>
                      <dd className='mt-1 flex min-w-0 flex-wrap gap-1.5 text-sm text-foreground'>
                        {Array.isArray(item.value) ? (
                          item.value.length > 0 ? (
                            item.value.map((value, valueIndex) => (
                              <span
                                key={`${item.key}-${value}-${valueIndex}`}
                                className='max-w-full truncate rounded border border-border/70 bg-card/70 px-2 py-0.5 text-xs text-muted-foreground'
                              >
                                {value}
                              </span>
                            ))
                          ) : (
                            <span className='text-muted-foreground'>None</span>
                          )
                        ) : (
                          <span className='min-w-0 break-words text-muted-foreground'>
                            {item.value || 'None'}
                          </span>
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            ) : (
              <p className='text-sm text-muted-foreground'>No source metadata.</p>
            )
          ) : null}
        </div>
      </div>
    </div>
  );
};

const SelectionPanel = ({
  incoming,
  node,
  nodesById,
  nodesByPath,
  nodesBySemanticId,
  onClose,
  onOpenFull,
  onSelect,
  outgoing,
  semanticSignals,
}: {
  incoming: PlanWorkstreamEdge[];
  node: PlanWorkstreamNode;
  nodesById: Map<string, PlanWorkstreamNode>;
  nodesByPath: Map<string, PlanWorkstreamNode>;
  nodesBySemanticId: Map<string, PlanWorkstreamNode>;
  onClose: () => void;
  onOpenFull: (nodeId: string) => void;
  onSelect: (nodeId: string) => void;
  outgoing: PlanWorkstreamEdge[];
  semanticSignals: SemanticSignal[];
}) => {
  const { hierarchy, relations } = mergeDrawerRelations(node.id, incoming, outgoing);
  const markdownContext = useMemo<MarkdownRenderContext>(
    () => ({
      nodesByPath,
      nodesBySemanticId,
      onOpenFull,
      sourceNode: node,
    }),
    [node, nodesByPath, nodesBySemanticId, onOpenFull],
  );
  const futureSignals = semanticSignals.filter(
    signal => signal.kind === 'future' || signal.kind === 'question',
  );
  const tensionSignals = semanticSignals.filter(signal => signal.kind === 'tension');
  const evolutionSignals = semanticSignals.filter(
    signal => signal.kind === 'decision' || signal.kind === 'evidence',
  );

  return (
    <aside className='pointer-events-auto absolute bottom-4 right-4 top-4 z-50 w-[min(400px,calc(100vw-2rem))] overflow-hidden rounded-lg border border-border/80 bg-card/90 shadow-2xl backdrop-blur-xl max-lg:bottom-3 max-lg:left-3 max-lg:right-3 max-lg:top-auto max-lg:h-[min(44vh,420px)] max-lg:w-auto'>
      <div className='flex h-full flex-col'>
        <div className='flex items-start gap-3 border-b border-border/70 px-4 py-3'>
          <div className='min-w-0 flex-1'>
            <div className='flex flex-wrap items-center gap-2'>
              <span className={cn('size-2 rounded-full', statusDotClassName(node.statusGroup))} />
              <span className='font-mono text-xs uppercase text-muted-foreground'>{node.kind}</span>
              <span className='font-mono text-xs text-muted-foreground'>{node.status}</span>
            </div>
            <h2 className='mt-2 line-clamp-2 text-lg font-semibold leading-tight'>
              {node.shortTitle}
            </h2>
          </div>
          <IconButton label='Clear selection' onClick={onClose}>
            <X className='size-4' />
          </IconButton>
        </div>

        <div className='min-h-0 flex-1 overflow-y-auto px-4 py-4'>
          {node.summary ? (
            <ShapeContentSummary
              className='text-sm leading-6'
              context={markdownContext}
              text={node.summary}
            />
          ) : null}

          {node.markdown ? (
            <button
              type='button'
              className='mt-4 inline-flex items-center gap-2 rounded-md border border-border/70 bg-background/70 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground'
              onClick={() => onOpenFull(node.id)}
            >
              <BookOpen className='size-3.5' />
              See full
            </button>
          ) : null}

          <div className='mt-5 grid gap-4'>
            {futureSignals.length > 0 ? (
              <div className='grid gap-2'>
                <h3 className='font-mono text-xs uppercase text-muted-foreground'>Future</h3>
                <SemanticSignalList
                  markdownContext={markdownContext}
                  nodesById={nodesById}
                  onOpenFull={onOpenFull}
                  showKind={false}
                  signals={futureSignals}
                />
              </div>
            ) : null}

            {tensionSignals.length > 0 ? (
              <div className='grid gap-2'>
                <h3 className='font-mono text-xs uppercase text-muted-foreground'>Tensions</h3>
                <SemanticSignalList
                  markdownContext={markdownContext}
                  nodesById={nodesById}
                  onOpenFull={onOpenFull}
                  showKind={false}
                  signals={tensionSignals}
                />
              </div>
            ) : null}

            {evolutionSignals.length > 0 ? (
              <div className='grid gap-2'>
                <h3 className='font-mono text-xs uppercase text-muted-foreground'>Evolution</h3>
                <SemanticSignalList
                  markdownContext={markdownContext}
                  nodesById={nodesById}
                  onOpenFull={onOpenFull}
                  signals={evolutionSignals}
                />
              </div>
            ) : null}

            {node.exemplars?.length ? (
              <div className='grid gap-2'>
                <h3 className='font-mono text-xs uppercase text-muted-foreground'>Examples</h3>
                <ExemplarList
                  exemplars={node.exemplars}
                  nodesBySemanticId={nodesBySemanticId}
                  onSelect={onSelect}
                />
              </div>
            ) : null}

            <div className='grid gap-2'>
              <h3 className='font-mono text-xs uppercase text-muted-foreground'>Structure</h3>
              <RelationList nodesById={nodesById} onSelect={onSelect} relations={hierarchy} />
            </div>
            <div className='grid gap-2'>
              <h3 className='font-mono text-xs uppercase text-muted-foreground'>Relations</h3>
              <RelationList nodesById={nodesById} onSelect={onSelect} relations={relations} />
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};

export const PlanWorkstreamExplorer = ({ snapshot }: PlanWorkstreamExplorerProps) => {
  const { theme, toggleTheme } = useTheme();
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(
    () => readAtlasRouteState().selectedNodeId,
  );
  const [atlasView, setAtlasView] = useState<AtlasView>('map');
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(() =>
    getInitialExpandedNodeIds(snapshot.nodes, snapshot.edges),
  );
  const [sproutingNodeDelays, setSproutingNodeDelays] = useState<Map<string, number>>(
    () => new Map(),
  );
  const [viewport, setViewport] = useState<Viewport>(fallbackViewport);
  const [isPanning, setIsPanning] = useState(false);
  const [detailOpen, setDetailOpen] = useState(() => Boolean(readAtlasRouteState().selectedNodeId));
  const [fullNodeId, setFullNodeId] = useState<string | null>(
    () => readAtlasRouteState().fullNodeId,
  );
  const [fullNodeHistoryIds, setFullNodeHistoryIds] = useState<string[]>([]);
  const [fullNodeTabsById, setFullNodeTabsById] = useState<Map<string, FullMarkdownModalTab>>(
    () => new Map(),
  );
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [edgeFocusBackNodeId, setEdgeFocusBackNodeId] = useState<string | null>(null);
  const [edgeHoverHint, setEdgeHoverHint] = useState<EdgeHoverHint | null>(null);
  const [autoFocusEnabled, setAutoFocusEnabled] = useState(true);
  const [showBoardHistory, setShowBoardHistory] = useState(false);
  const [themeToggleMounted, setThemeToggleMounted] = useState(false);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const boardNodeRefs = useRef(new Map<string, HTMLElement>());
  const viewportRef = useRef<Viewport>(fallbackViewport);
  const hasInitializedViewportRef = useRef(false);
  const hasAppliedInitialRouteRef = useRef(false);
  const edgeHoverHideTimeoutRef = useRef<ReturnType<typeof globalThis.setTimeout> | null>(null);
  const sproutAnimationTimeoutRef = useRef<ReturnType<typeof globalThis.setTimeout> | null>(null);
  const viewportAnimationRef = useRef<number | null>(null);
  const pendingFocusNodeIdRef = useRef<string | null>(null);
  const pointersRef = useRef(new Map<number, PointerPoint>());
  const gestureRef = useRef<GestureState | null>(null);
  const nativeGestureRef = useRef<NativeGestureState | null>(null);
  const referenceNodes = useMemo(() => {
    const nodesByReferenceId = new Map<string, PlanWorkstreamNode>();

    for (const node of [...(snapshot.documents ?? []), ...snapshot.nodes]) {
      nodesByReferenceId.set(node.id, node);
    }

    return [...nodesByReferenceId.values()];
  }, [snapshot.documents, snapshot.nodes]);
  const nodesById = useMemo(
    () => new Map(referenceNodes.map(node => [node.id, node])),
    [referenceNodes],
  );
  const canvasNodeIds = useMemo(
    () => new Set(snapshot.nodes.map(node => node.id)),
    [snapshot.nodes],
  );
  const nodesByPath = useMemo(() => {
    const nodes = new Map<string, PlanWorkstreamNode>();

    for (const node of referenceNodes) {
      if (node.path) {
        nodes.set(node.path, node);
      }

      if (node.sourceFilePath) {
        nodes.set(node.sourceFilePath, node);
      }

    }

    return nodes;
  }, [referenceNodes]);
  const nodesBySemanticId = useMemo(
    () =>
      new Map(
        referenceNodes
          .filter(node => node.semanticId)
          .map(node => [node.semanticId as string, node] as const),
      ),
    [referenceNodes],
  );
  const semanticSignalsByTargetId = useMemo(() => {
    const signalsByTargetId = new Map<string, SemanticSignal[]>();

    for (const sourceNode of referenceNodes) {
      for (const signal of extractSemanticSignals(sourceNode)) {
        const existingSignals = signalsByTargetId.get(signal.targetSemanticId) ?? [];
        signalsByTargetId.set(signal.targetSemanticId, [...existingSignals, signal]);
      }
    }

    return signalsByTargetId;
  }, [referenceNodes]);
  const searchMatches = useMemo(
    () => getSearchMatches(snapshot.nodes, query),
    [query, snapshot.nodes],
  );
  const hierarchyIndex = useMemo(
    () => getHierarchyIndex(snapshot.nodes, snapshot.edges),
    [snapshot.edges, snapshot.nodes],
  );
  const statusVisibleNodeIds = useMemo(
    () => getStatusVisibleNodeIds(snapshot.nodes, snapshot.edges, allStatuses),
    [snapshot.edges, snapshot.nodes],
  );
  const visibleNodeIds = useMemo(
    () =>
      getExpandedVisibleNodeIds(
        snapshot.nodes,
        statusVisibleNodeIds,
        hierarchyIndex.parentByChild,
        expandedNodeIds,
      ),
    [expandedNodeIds, hierarchyIndex.parentByChild, snapshot.nodes, statusVisibleNodeIds],
  );
  const expandableBranchStatsByParent = useMemo(() => {
    const branchStatsByParent = new Map<
      string,
      { directChildCount: number; totalDescendantCount: number }
    >();

    for (const [parentId, childIds] of hierarchyIndex.primaryChildrenByParent) {
      const directChildCount = childIds.filter(childId => statusVisibleNodeIds.has(childId)).length;

      if (directChildCount > 0) {
        const totalDescendantCount = getDescendantIds(
          parentId,
          hierarchyIndex.primaryChildrenByParent,
        ).filter(descendantId => statusVisibleNodeIds.has(descendantId)).length;

        branchStatsByParent.set(parentId, { directChildCount, totalDescendantCount });
      }
    }

    return branchStatsByParent;
  }, [hierarchyIndex.primaryChildrenByParent, statusVisibleNodeIds]);
  const initialExpandedNodeIds = useMemo(
    () => getInitialExpandedNodeIds(snapshot.nodes, snapshot.edges),
    [snapshot.edges, snapshot.nodes],
  );
  const themeToggleLabel = themeToggleMounted
    ? theme === 'light'
      ? 'Switch to dark mode'
      : 'Switch to light mode'
    : 'Toggle theme';
  const visibleNodes = useMemo(
    () => snapshot.nodes.filter(node => visibleNodeIds.has(node.id)),
    [snapshot.nodes, visibleNodeIds],
  );
  const globalBoardNodes = useMemo(
    () => sortBoardNodes(snapshot.nodes.filter(node => node.kind !== 'root')),
    [snapshot.nodes],
  );
  const globalBoardColumns = useMemo(() => {
    const columns: Record<BoardColumnKey, PlanWorkstreamNode[]> = {
      later: [],
      next: [],
      now: [],
      past: [],
    };

    for (const node of globalBoardNodes) {
      columns[getBoardColumnKey(node)].push(node);
    }

    return columns;
  }, [globalBoardNodes]);
  const visibleEdges = useMemo(
    () =>
      snapshot.edges.filter(edge => visibleNodeIds.has(edge.from) && visibleNodeIds.has(edge.to)),
    [snapshot.edges, visibleNodeIds],
  );
  const renderedEdges = useMemo(() => getRenderedEdges(visibleEdges), [visibleEdges]);
  const selectedNode = selectedNodeId ? nodesById.get(selectedNodeId) : null;
  const fullNode = fullNodeId ? nodesById.get(fullNodeId) : null;
  const fullNodeNavigationBackNode =
    fullNodeHistoryIds.length > 0
      ? (nodesById.get(fullNodeHistoryIds[fullNodeHistoryIds.length - 1] ?? '') ?? null)
      : null;
  const fullNodeActiveTab = fullNode
    ? (fullNodeTabsById.get(fullNode.id) ?? defaultFullMarkdownModalTab)
    : defaultFullMarkdownModalTab;
  const edgeHover = edgeHoverHint
    ? (renderedEdges.find(edge => edge.id === edgeHoverHint.edgeId) ?? null)
    : null;
  const edgeHoverTargetNodeId = edgeHover
    ? selectedNodeId === edgeHover.to
      ? edgeHover.from
      : edgeHover.to
    : null;
  const edgeHoverSourceNodeId = edgeHover
    ? selectedNodeId === edgeHover.to
      ? edgeHover.to
      : edgeHover.from
    : null;
  const edgeHoverDirection: RelationDirection | null = edgeHover
    ? edgeHover.reciprocal
      ? 'both'
      : selectedNodeId === edgeHover.to
        ? 'in'
        : 'out'
    : null;
  const edgeHoverTargetNode = edgeHoverTargetNodeId
    ? (nodesById.get(edgeHoverTargetNodeId) ?? null)
    : null;
  const edgeHoverSourceNode = edgeHoverSourceNodeId
    ? (nodesById.get(edgeHoverSourceNodeId) ?? null)
    : null;
  const edgeHoverPosition = edgeHoverHint ? getEdgeHintPosition(edgeHoverHint) : null;
  const edgeFocusBackNode = edgeFocusBackNodeId
    ? (nodesById.get(edgeFocusBackNodeId) ?? null)
    : null;
  const graph = useMemo(
    () => getGraphLayout(visibleNodes, visibleEdges),
    [visibleEdges, visibleNodes],
  );
  const nodeFocusLevels = useMemo(() => {
    const activeNodeIds = new Set<string>();

    if (selectedNodeId && visibleNodeIds.has(selectedNodeId)) {
      activeNodeIds.add(selectedNodeId);
    }

    if (hoveredNodeId && visibleNodeIds.has(hoveredNodeId)) {
      activeNodeIds.add(hoveredNodeId);
    }

    if (edgeHover) {
      activeNodeIds.add(edgeHover.from);
      activeNodeIds.add(edgeHover.to);
    }

    return getNodeFocusLevels({
      activeNodeIds,
      hierarchyIndex,
      visibleEdges,
      visibleNodeIds,
    });
  }, [edgeHover, hierarchyIndex, hoveredNodeId, selectedNodeId, visibleEdges, visibleNodeIds]);
  const outgoing = selectedNode
    ? snapshot.edges.filter(edge => edge.from === selectedNode.id)
    : [];
  const incoming = selectedNode ? snapshot.edges.filter(edge => edge.to === selectedNode.id) : [];
  const fullNodeEdges = snapshot.edges;

  const getFitViewport = useCallback(() => {
    const rect = canvasRef.current?.getBoundingClientRect();

    if (!rect || graph.width === 0 || graph.height === 0) {
      return fallbackViewport;
    }

    const padding = 48;
    const availableWidth = Math.max(120, rect.width - padding * 2);
    const availableHeight = Math.max(120, rect.height - padding * 2);
    const scale = clampScale(
      Math.min(availableWidth / graph.width, availableHeight / graph.height),
    );

    return {
      scale,
      x: (rect.width - graph.width * scale) / 2,
      y: (rect.height - graph.height * scale) / 2,
    };
  }, [graph.height, graph.width]);

  const cancelViewportAnimation = useCallback(() => {
    if (viewportAnimationRef.current === null) {
      return;
    }

    globalThis.cancelAnimationFrame(viewportAnimationRef.current);
    viewportAnimationRef.current = null;
  }, []);

  const animateViewportTo = useCallback(
    (target: Viewport) => {
      cancelViewportAnimation();
      const start = viewportRef.current;
      const startedAt = performance.now();
      const durationMs = 420;

      const step = (time: number) => {
        const progress = Math.min(1, (time - startedAt) / durationMs);
        const eased = 1 - (1 - progress) ** 3;
        const next = {
          scale: start.scale + (target.scale - start.scale) * eased,
          x: start.x + (target.x - start.x) * eased,
          y: start.y + (target.y - start.y) * eased,
        };

        viewportRef.current = next;
        setViewport(next);

        if (progress < 1) {
          viewportAnimationRef.current = globalThis.requestAnimationFrame(step);
          return;
        }

        viewportAnimationRef.current = null;
      };

      viewportAnimationRef.current = globalThis.requestAnimationFrame(step);
    },
    [cancelViewportAnimation],
  );

  const getFocusedViewport = useCallback((node: PositionedNode) => {
    const rect = canvasRef.current?.getBoundingClientRect();

    if (!rect) {
      return null;
    }

    const scale = clampScale(Math.max(viewportRef.current.scale, focusScale));
    const nodeCenterX = node.x + node.width / 2;
    const nodeCenterY = node.y + node.height / 2;

    const focusXRatio = rect.width >= 1024 ? 0.34 : 0.44;

    return {
      scale,
      x: rect.width * focusXRatio - nodeCenterX * scale,
      y: rect.height * 0.48 - nodeCenterY * scale,
    };
  }, []);

  const focusNode = useCallback(
    (nodeId: string) => {
      const node = graph.positioned.get(nodeId);

      if (!node) {
        pendingFocusNodeIdRef.current = nodeId;
        return;
      }

      const next = getFocusedViewport(node);

      if (!next) {
        pendingFocusNodeIdRef.current = nodeId;
        return;
      }

      pendingFocusNodeIdRef.current = null;
      animateViewportTo(next);
    },
    [animateViewportTo, getFocusedViewport, graph.positioned],
  );

  const applyViewport = (updater: (current: Viewport) => Viewport) => {
    cancelViewportAnimation();
    setViewport(current => {
      const next = updater(current);
      viewportRef.current = next;
      return next;
    });
  };

  useLayoutEffect(() => {
    if (hasInitializedViewportRef.current) {
      return;
    }

    if (!canvasRef.current || graph.width === 0 || graph.height === 0) {
      return;
    }

    const next = getFitViewport();
    hasInitializedViewportRef.current = true;
    viewportRef.current = next;
    setViewport(next);
  }, [getFitViewport, graph.height, graph.width]);

  useEffect(() => {
    setThemeToggleMounted(true);
  }, []);

  useEffect(() => {
    if (!searchOpen) {
      return;
    }

    searchInputRef.current?.focus();
    searchInputRef.current?.select();
  }, [searchOpen]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'k' || (!event.metaKey && !event.ctrlKey) || event.altKey) {
        return;
      }

      event.preventDefault();
      setSearchOpen(true);
    };

    globalThis.window.addEventListener('keydown', handleKeyDown);

    return () => {
      globalThis.window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    const pendingNodeId = pendingFocusNodeIdRef.current;

    if (!pendingNodeId) {
      return;
    }

    focusNode(pendingNodeId);
  });

  useEffect(
    () => () => {
      if (viewportAnimationRef.current !== null) {
        globalThis.cancelAnimationFrame(viewportAnimationRef.current);
      }

      if (edgeHoverHideTimeoutRef.current !== null) {
        globalThis.clearTimeout(edgeHoverHideTimeoutRef.current);
      }

      if (sproutAnimationTimeoutRef.current !== null) {
        globalThis.clearTimeout(sproutAnimationTimeoutRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (!selectedNodeId || visibleNodeIds.has(selectedNodeId)) {
      return;
    }

    setSelectedNodeId(null);
    setDetailOpen(false);
    writeAtlasRouteState({ fullNodeId, selectedNodeId: null }, 'replace');
  }, [fullNodeId, selectedNodeId, visibleNodeIds]);

  useEffect(() => {
    if (atlasView !== 'map') {
      nativeGestureRef.current = null;
      return;
    }

    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const shouldHandleMapGesture = (event: NativeGestureEvent | NativeWheelEvent) => {
      const target = event.target instanceof Element ? event.target : null;

      if (target && !canvas.contains(target)) {
        return false;
      }

      if (!target) {
        const rect = canvas.getBoundingClientRect();
        const clientX = event.clientX;
        const clientY = event.clientY;

        return (
          typeof clientX === 'number' &&
          typeof clientY === 'number' &&
          clientX >= rect.left &&
          clientX <= rect.right &&
          clientY >= rect.top &&
          clientY <= rect.bottom
        );
      }

      const isNodeTarget = Boolean(target.closest('[data-node-id]'));
      const isMapControlTarget = Boolean(target.closest('[data-collapse-toggle]'));
      const isInteractiveTarget = Boolean(target.closest('input, textarea, select, button, a'));

      return !isInteractiveTarget || isNodeTarget || isMapControlTarget;
    };

    const handleNativeWheel = (event: NativeWheelEvent) => {
      if (!shouldHandleMapGesture(event)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      cancelViewportAnimation();

      if (nativeGestureRef.current) {
        return;
      }

      const rect = canvas.getBoundingClientRect();
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? rect.height : 1;
      const deltaX = event.deltaX * unit;
      const deltaY = event.deltaY * unit;
      const isZoomGesture = event.ctrlKey || event.metaKey || Math.abs(event.deltaZ) > 0;

      if (!isZoomGesture) {
        setViewport(current => {
          const next = {
            ...current,
            x: current.x - deltaX,
            y: current.y - deltaY,
          };

          viewportRef.current = next;
          return next;
        });
        return;
      }

      const pointerX = event.clientX - rect.left;
      const pointerY = event.clientY - rect.top;
      const wheelDelta =
        Math.abs(deltaY) > 0
          ? deltaY
          : typeof event.wheelDelta === 'number'
            ? -event.wheelDelta
            : 0;

      setViewport(current => {
        const nextScale = clampScale(
          current.scale *
            Math.exp(-wheelDelta * wheelZoomSpeed * getZoomSensitivityMultiplier(current.scale)),
        );
        const ratio = nextScale / current.scale;
        const next = {
          scale: nextScale,
          x: pointerX - (pointerX - current.x) * ratio,
          y: pointerY - (pointerY - current.y) * ratio,
        };

        viewportRef.current = next;
        return next;
      });
    };

    const getGesturePoint = (event: NativeGestureEvent) => {
      const rect = canvas.getBoundingClientRect();
      const clientX = event.clientX;
      const clientY = event.clientY;
      const hasClientPoint =
        typeof clientX === 'number' &&
        Number.isFinite(clientX) &&
        typeof clientY === 'number' &&
        Number.isFinite(clientY);

      return {
        x: hasClientPoint ? clientX - rect.left : rect.width / 2,
        y: hasClientPoint ? clientY - rect.top : rect.height / 2,
      };
    };

    const handleGestureStart = (event: NativeGestureEvent) => {
      if (!shouldHandleMapGesture(event)) {
        return;
      }

      event.preventDefault();
      cancelViewportAnimation();
      const point = getGesturePoint(event);
      nativeGestureRef.current = {
        anchorX: point.x,
        anchorY: point.y,
        startScale: viewportRef.current.scale,
        startX: viewportRef.current.x,
        startY: viewportRef.current.y,
      };
    };

    const handleGestureChange = (event: NativeGestureEvent) => {
      if (!shouldHandleMapGesture(event)) {
        return;
      }

      event.preventDefault();
      const gesture = nativeGestureRef.current;
      const eventScale = typeof event.scale === 'number' ? event.scale : Number.NaN;

      if (!gesture || !Number.isFinite(eventScale) || eventScale <= 0) {
        return;
      }

      setViewport(() => {
        const nextScale = clampScale(
          gesture.startScale * amplifyZoomRatio(eventScale, gesture.startScale),
        );
        const worldX = (gesture.anchorX - gesture.startX) / gesture.startScale;
        const worldY = (gesture.anchorY - gesture.startY) / gesture.startScale;
        const next = {
          scale: nextScale,
          x: gesture.anchorX - worldX * nextScale,
          y: gesture.anchorY - worldY * nextScale,
        };

        viewportRef.current = next;
        return next;
      });
    };

    const handleGestureEnd = (event: NativeGestureEvent) => {
      if (!shouldHandleMapGesture(event)) {
        return;
      }

      event.preventDefault();
      nativeGestureRef.current = null;
    };

    globalThis.addEventListener('wheel', handleNativeWheel, {
      capture: true,
      passive: false,
    });
    globalThis.addEventListener('gesturestart', handleGestureStart as EventListener, {
      capture: true,
      passive: false,
    });
    globalThis.addEventListener('gesturechange', handleGestureChange as EventListener, {
      capture: true,
      passive: false,
    });
    globalThis.addEventListener('gestureend', handleGestureEnd as EventListener, {
      capture: true,
      passive: false,
    });

    return () => {
      globalThis.removeEventListener('wheel', handleNativeWheel, { capture: true });
      globalThis.removeEventListener('gesturestart', handleGestureStart as EventListener, {
        capture: true,
      });
      globalThis.removeEventListener('gesturechange', handleGestureChange as EventListener, {
        capture: true,
      });
      globalThis.removeEventListener('gestureend', handleGestureEnd as EventListener, {
        capture: true,
      });
    };
  }, [atlasView, cancelViewportAnimation]);

  const resetViewport = () => {
    applyViewport(() => getFitViewport());
  };

  const resetBranches = () => {
    setExpandedNodeIds(new Set(initialExpandedNodeIds));
  };

  const zoomBy = (delta: number) => {
    applyViewport(current => ({ ...current, scale: clampScale(current.scale + delta) }));
  };

  const revealNodePath = useCallback(
    (nodeId: string) => {
      const ancestorIds = getAncestorIds(nodeId, hierarchyIndex.parentByChild);

      if (ancestorIds.length === 0) {
        return;
      }

      setExpandedNodeIds(current => {
        const next = new Set(current);
        let changed = false;

        for (const ancestorId of ancestorIds) {
          if (next.has(ancestorId)) {
            continue;
          }

          next.add(ancestorId);
          changed = true;
        }

        return changed ? next : current;
      });
    },
    [hierarchyIndex.parentByChild],
  );

  const selectNode = (nodeId: string, input: { focus?: boolean; route?: boolean } = {}) => {
    revealNodePath(nodeId);
    setSelectedNodeId(nodeId);
    setDetailOpen(true);
    setFullNodeId(null);
    setFullNodeHistoryIds([]);
    setHoveredNodeId(null);

    if (input.route ?? true) {
      writeAtlasRouteState({ fullNodeId: null, selectedNodeId: nodeId });
    }

    if (input.focus ?? autoFocusEnabled) {
      focusNode(nodeId);
    }
  };

  const clearSelection = (input: { route?: boolean } = {}) => {
    setSelectedNodeId(null);
    setDetailOpen(false);
    setFullNodeHistoryIds([]);
    setHoveredNodeId(null);

    if (input.route ?? true) {
      writeAtlasRouteState({ fullNodeId, selectedNodeId: null });
    }
  };

  const openFullNode = useCallback(
    (nodeId: string) => {
      const isCanvasNode = canvasNodeIds.has(nodeId);

      if (isCanvasNode) {
        revealNodePath(nodeId);
        setSelectedNodeId(nodeId);
        setHoveredNodeId(null);
      }

      if (fullNodeId && fullNodeId !== nodeId) {
        setFullNodeHistoryIds(current => {
          const next =
            current[current.length - 1] === fullNodeId ? current : [...current, fullNodeId];

          return next.slice(-24);
        });
      }

      setFullNodeId(nodeId);
      writeAtlasRouteState({
        fullNodeId: nodeId,
        selectedNodeId: isCanvasNode ? nodeId : selectedNodeId,
      });
    },
    [canvasNodeIds, fullNodeId, revealNodePath, selectedNodeId],
  );

  const closeFullNode = () => {
    setFullNodeId(null);
    setFullNodeHistoryIds([]);
    writeAtlasRouteState({ fullNodeId: null, selectedNodeId });
  };

  const navigateFullNodeBack = useCallback(() => {
    const previousNodeId = fullNodeHistoryIds[fullNodeHistoryIds.length - 1];

    if (!previousNodeId) {
      return;
    }

    const previousNode = nodesById.get(previousNodeId);
    const isCanvasNode = canvasNodeIds.has(previousNodeId);

    setFullNodeHistoryIds(current => current.slice(0, -1));

    if (isCanvasNode) {
      revealNodePath(previousNodeId);
      setSelectedNodeId(previousNodeId);
      setHoveredNodeId(null);
    }

    setFullNodeId(previousNodeId);
    writeAtlasRouteState(
      {
        fullNodeId: previousNodeId,
        selectedNodeId: isCanvasNode ? previousNodeId : selectedNodeId,
      },
      'replace',
    );

    if (isCanvasNode && previousNode && atlasView === 'map') {
      focusNode(previousNode.id);
    }
  }, [
    atlasView,
    canvasNodeIds,
    focusNode,
    fullNodeHistoryIds,
    nodesById,
    revealNodePath,
    selectedNodeId,
  ]);

  const setFullNodeActiveTab = useCallback((nodeId: string, tab: FullMarkdownModalTab) => {
    setFullNodeTabsById(current => {
      if (current.get(nodeId) === tab) {
        return current;
      }

      const next = new Map(current);
      next.set(nodeId, tab);
      return next;
    });
  }, []);

  const boardSourceNode = nodesById.get(rootNodeId) ?? snapshot.nodes[0];
  const boardMarkdownContext = useMemo<MarkdownRenderContext | null>(
    () =>
      boardSourceNode
        ? {
            nodesByPath,
            nodesBySemanticId,
            onOpenFull: openFullNode,
            sourceNode: boardSourceNode,
          }
        : null,
    [boardSourceNode, nodesByPath, nodesBySemanticId, openFullNode],
  );
  const registerBoardNode = useCallback((nodeId: string, element: HTMLElement | null) => {
    if (element) {
      boardNodeRefs.current.set(nodeId, element);
      return;
    }

    boardNodeRefs.current.delete(nodeId);
  }, []);
  const scrollBoardNodeIntoView = useCallback((nodeId: string) => {
    globalThis.requestAnimationFrame(() => {
      boardNodeRefs.current.get(nodeId)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'center',
      });
    });
  }, []);

  const clearEdgeHoverHideTimeout = () => {
    if (edgeHoverHideTimeoutRef.current === null) {
      return;
    }

    globalThis.clearTimeout(edgeHoverHideTimeoutRef.current);
    edgeHoverHideTimeoutRef.current = null;
  };

  const showEdgeHint = (edgeId: string, event: ReactPointerEvent<SVGPathElement>) => {
    clearEdgeHoverHideTimeout();
    setEdgeHoverHint({
      clientX: event.clientX,
      clientY: event.clientY,
      edgeId,
    });
  };

  const scheduleEdgeHintHide = () => {
    clearEdgeHoverHideTimeout();
    edgeHoverHideTimeoutRef.current = globalThis.setTimeout(() => {
      setEdgeHoverHint(null);
      edgeHoverHideTimeoutRef.current = null;
    }, 240);
  };

  const focusEdgeTarget = () => {
    if (!edgeHover || !edgeHoverTargetNodeId) {
      return;
    }

    setEdgeFocusBackNodeId(selectedNodeId ?? edgeHoverSourceNodeId ?? edgeHover.from);
    setEdgeHoverHint(null);
    selectNode(edgeHoverTargetNodeId, { focus: true });
  };

  const focusEdgeBackNode = () => {
    if (!edgeFocusBackNodeId) {
      return;
    }

    const nextBackNodeId = selectedNodeId;
    selectNode(edgeFocusBackNodeId, { focus: true });
    setEdgeFocusBackNodeId(nextBackNodeId);
  };

  const selectSearchMatch = (node: PlanWorkstreamNode) => {
    setQuery('');
    setSearchOpen(false);

    if (atlasView === 'board') {
      setSelectedNodeId(node.id);
      setDetailOpen(false);
      setFullNodeId(null);
      setFullNodeHistoryIds([]);
      setHoveredNodeId(null);
      writeAtlasRouteState({ fullNodeId: null, selectedNodeId: node.id });
      scrollBoardNodeIntoView(node.id);
      return;
    }

    setAtlasView('map');
    selectNode(node.id, { focus: true });
  };

  const toggleExpandedNode = (nodeId: string) => {
    const isExpanding = !expandedNodeIds.has(nodeId);

    if (autoFocusEnabled) {
      pendingFocusNodeIdRef.current = nodeId;
    }

    if (sproutAnimationTimeoutRef.current !== null) {
      globalThis.clearTimeout(sproutAnimationTimeoutRef.current);
      sproutAnimationTimeoutRef.current = null;
    }

    if (isExpanding) {
      const directChildIds = (hierarchyIndex.primaryChildrenByParent.get(nodeId) ?? []).filter(
        childId => statusVisibleNodeIds.has(childId),
      );

      setSproutingNodeDelays(
        new Map(directChildIds.map((childId, childIndex) => [childId, childIndex])),
      );
      sproutAnimationTimeoutRef.current = globalThis.setTimeout(() => {
        setSproutingNodeDelays(new Map());
        sproutAnimationTimeoutRef.current = null;
      }, 700);
    } else {
      setSproutingNodeDelays(new Map());
    }

    setExpandedNodeIds(current => {
      const next = new Set(current);
      const descendantIds = getDescendantIds(nodeId, hierarchyIndex.primaryChildrenByParent);

      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }

      for (const descendantId of descendantIds) {
        next.delete(descendantId);
      }

      return next;
    });
  };

  useEffect(() => {
    if (hasAppliedInitialRouteRef.current) {
      return;
    }

    hasAppliedInitialRouteRef.current = true;
    const routeState = readAtlasRouteState();
    const routeSelectedNodeId =
      routeState.selectedNodeId && canvasNodeIds.has(routeState.selectedNodeId)
        ? routeState.selectedNodeId
        : null;
    const routeFullNodeId =
      routeState.fullNodeId && nodesById.has(routeState.fullNodeId) ? routeState.fullNodeId : null;

    if (routeSelectedNodeId) {
      revealNodePath(routeSelectedNodeId);
      setSelectedNodeId(routeSelectedNodeId);
      setDetailOpen(true);
      focusNode(routeSelectedNodeId);
    }

    if (routeFullNodeId) {
      setFullNodeId(routeFullNodeId);
    }
  }, [canvasNodeIds, focusNode, nodesById, revealNodePath]);

  useEffect(() => {
    const handlePopState = () => {
      const routeState = readAtlasRouteState();
      const nextSelectedNodeId =
        routeState.selectedNodeId && canvasNodeIds.has(routeState.selectedNodeId)
          ? routeState.selectedNodeId
          : null;
      const nextFullNodeId =
        routeState.fullNodeId && nodesById.has(routeState.fullNodeId)
          ? routeState.fullNodeId
          : null;

      if (nextSelectedNodeId) {
        revealNodePath(nextSelectedNodeId);
        focusNode(nextSelectedNodeId);
      }

      setSelectedNodeId(nextSelectedNodeId);
      setDetailOpen(Boolean(nextSelectedNodeId));
      setFullNodeId(nextFullNodeId);
      setFullNodeHistoryIds(current => {
        if (!nextFullNodeId) {
          return [];
        }

        return current[current.length - 1] === nextFullNodeId ? current.slice(0, -1) : current;
      });
      setHoveredNodeId(null);
    };

    globalThis.addEventListener('popstate', handlePopState);

    return () => globalThis.removeEventListener('popstate', handlePopState);
  }, [canvasNodeIds, focusNode, nodesById, revealNodePath]);

  const setPinchGesture = () => {
    const rect = canvasRef.current?.getBoundingClientRect();
    const points = [...pointersRef.current.values()];

    if (!rect || points.length < 2) {
      return;
    }

    const [left, right] = points;
    const center = getPointerCenter(left, right, rect);
    gestureRef.current = {
      mode: 'pinch',
      startCenterX: center.x,
      startCenterY: center.y,
      startDistance: getPointerDistance(left, right),
      startScale: viewportRef.current.scale,
      startX: viewportRef.current.x,
      startY: viewportRef.current.y,
    };
  };

  const setPanGesture = (
    pointerId: number,
    point: PointerPoint,
    startNodeId: string | null,
    startCollapseToggleNodeId: string | null = null,
  ) => {
    gestureRef.current = {
      mode: 'pan',
      hasMoved: false,
      pointerId,
      startClientX: point.clientX,
      startClientY: point.clientY,
      startCollapseToggle: Boolean(startCollapseToggleNodeId),
      startCollapseToggleNodeId,
      startNodeId,
      startX: viewportRef.current.x,
      startY: viewportRef.current.y,
    };
  };

  const handleCanvasPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return;
    }

    cancelViewportAnimation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = { clientX: event.clientX, clientY: event.clientY };
    const targetCollapseToggle = (event.target as HTMLElement).closest<HTMLElement>(
      '[data-collapse-toggle]',
    );
    const targetNodeId = targetCollapseToggle
      ? null
      : ((event.target as HTMLElement).closest<HTMLElement>('[data-node-id]')?.dataset.nodeId ??
        null);
    const targetCollapseToggleNodeId = targetCollapseToggle?.dataset.collapseNodeId ?? null;
    pointersRef.current.set(event.pointerId, point);
    setIsPanning(true);

    if (pointersRef.current.size >= 2) {
      setPinchGesture();
      return;
    }

    setPanGesture(event.pointerId, point, targetNodeId, targetCollapseToggleNodeId);
  };

  const handleCanvasPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const point = { clientX: event.clientX, clientY: event.clientY };

    if (!pointersRef.current.has(event.pointerId)) {
      return;
    }

    pointersRef.current.set(event.pointerId, point);
    const gesture = gestureRef.current;

    if (!gesture) {
      return;
    }

    if (gesture.mode === 'pinch') {
      const rect = canvasRef.current?.getBoundingClientRect();
      const points = [...pointersRef.current.values()];

      if (!rect || points.length < 2 || gesture.startDistance === 0) {
        return;
      }

      const [left, right] = points;
      const center = getPointerCenter(left, right, rect);
      const nextScale = clampScale(
        gesture.startScale *
          amplifyZoomRatio(
            getPointerDistance(left, right) / gesture.startDistance,
            gesture.startScale,
          ),
      );
      const worldX = (gesture.startCenterX - gesture.startX) / gesture.startScale;
      const worldY = (gesture.startCenterY - gesture.startY) / gesture.startScale;

      applyViewport(() => ({
        scale: nextScale,
        x: center.x - worldX * nextScale,
        y: center.y - worldY * nextScale,
      }));
      return;
    }

    if (gesture.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - gesture.startClientX;
    const deltaY = event.clientY - gesture.startClientY;

    if (Math.hypot(deltaX, deltaY) > 4) {
      gestureRef.current = { ...gesture, hasMoved: true };
    }

    applyViewport(current => ({
      ...current,
      x: gesture.startX + deltaX,
      y: gesture.startY + deltaY,
    }));
  };

  const handleCanvasPointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    pointersRef.current.delete(event.pointerId);

    if (pointersRef.current.size === 0) {
      if (gesture?.mode === 'pan' && gesture.pointerId === event.pointerId && !gesture.hasMoved) {
        if (gesture.startCollapseToggleNodeId) {
          toggleExpandedNode(gesture.startCollapseToggleNodeId);
        } else if (gesture.startNodeId) {
          selectNode(gesture.startNodeId, { focus: autoFocusEnabled });
        } else if (!gesture.startCollapseToggle) {
          clearSelection();
        }
      }

      gestureRef.current = null;
      setIsPanning(false);
      return;
    }

    const [remainingPointerId, remainingPoint] = [...pointersRef.current.entries()][0];
    setPanGesture(remainingPointerId, remainingPoint, null);
  };

  return (
    <main className='fixed inset-0 overflow-hidden bg-background text-foreground'>
      {atlasView === 'map' ? (
        <div
          ref={canvasRef}
          className={cn(
            'absolute inset-0 select-none overflow-hidden bg-[radial-gradient(circle_at_1px_1px,rgba(113,113,122,0.24)_1px,transparent_0)] [background-size:24px_24px]',
            isPanning ? 'cursor-grabbing' : 'cursor-grab',
          )}
          style={{ overscrollBehavior: 'none', touchAction: 'none' }}
          onPointerCancel={handleCanvasPointerEnd}
          onPointerDown={handleCanvasPointerDown}
          onPointerMove={handleCanvasPointerMove}
          onPointerUp={handleCanvasPointerEnd}
        >
          <div
            className='absolute left-0 top-0 origin-top-left will-change-transform'
            style={{
              height: graph.height,
              transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})`,
              width: graph.width,
            }}
          >
            <svg
              className='absolute inset-0'
              height={graph.height}
              viewBox={`0 0 ${graph.width} ${graph.height}`}
              width={graph.width}
            >
              {renderedEdges.map(edge => {
                const from = graph.positioned.get(edge.from);
                const to = graph.positioned.get(edge.to);
                const fromFocusLevel = getNodeFocusLevel(edge.from, nodeFocusLevels);
                const toFocusLevel = getNodeFocusLevel(edge.to, nodeFocusLevels);
                const edgeFocusLevel =
                  nodeFocusLevels === null
                    ? 'normal'
                    : fromFocusLevel === 'distant' || toFocusLevel === 'distant'
                      ? 'distant'
                      : fromFocusLevel === 'context' || toFocusLevel === 'context'
                        ? 'context'
                        : 'primary';
                const hovered = edgeHover?.id === edge.id;
                const hoverable = hasEdgeNavigationHint(edge.kind);

                if (!from || !to) {
                  return null;
                }

                return (
                  <Fragment key={edge.id}>
                    <path
                      className={cn(
                        'pointer-events-none fill-none transition-[opacity,stroke-width]',
                        hovered ? 'stroke-[2.5] opacity-100' : 'stroke-[1.5]',
                        !hovered &&
                          (edgeFocusLevel === 'distant'
                            ? 'opacity-[0.08]'
                            : edgeFocusLevel === 'context'
                              ? 'opacity-[0.35]'
                              : 'opacity-75'),
                        relationStyle[edge.kind],
                      )}
                      d={edgePath(from, to)}
                    />
                    {hoverable ? (
                      <path
                        className='fill-none stroke-transparent stroke-[14]'
                        d={edgePath(from, to)}
                        style={{ pointerEvents: 'stroke' }}
                        onPointerEnter={event => showEdgeHint(edge.id, event)}
                        onPointerLeave={scheduleEdgeHintHide}
                      />
                    ) : null}
                  </Fragment>
                );
              })}
            </svg>

            {graph.nodes.map(node => {
              const focusLevel = getNodeFocusLevel(node.id, nodeFocusLevels);
              const selected = node.id === selectedNode?.id;
              const sproutIndex = sproutingNodeDelays.get(node.id);
              const branchStats = expandableBranchStatsByParent.get(node.id);

              return (
                <div
                  key={node.id}
                  className={cn(
                    'absolute transition-[left,top] duration-300 ease-out motion-reduce:transition-none',
                    typeof sproutIndex === 'number' && 'atlas-sprout-node',
                  )}
                  style={{
                    ...(typeof sproutIndex === 'number'
                      ? {
                          animation: 'atlas-node-sprout 420ms cubic-bezier(0.16, 1, 0.3, 1) both',
                          animationDelay: `${Math.min(sproutIndex, 8) * 55}ms`,
                        }
                      : {}),
                    height: node.height,
                    left: node.x,
                    top: node.y,
                    width: node.width,
                    zIndex:
                      focusLevel === 'distant'
                        ? 0
                        : selected
                          ? 30
                          : focusLevel === 'primary'
                            ? 20
                            : 10,
                  }}
                  onMouseEnter={() => setHoveredNodeId(node.id)}
                  onMouseLeave={() => setHoveredNodeId(null)}
                >
                  <div aria-hidden='true' className={nodeShieldClassName(node)} />
                  <NodeCard
                    focusLevel={focusLevel}
                    node={node}
                    onDoubleClick={() => openFullNode(node.id)}
                    onSelect={() => selectNode(node.id, { focus: autoFocusEnabled })}
                    selected={selected}
                  />
                  <BranchSproutToggle
                    directChildCount={branchStats?.directChildCount ?? 0}
                    expanded={expandedNodeIds.has(node.id)}
                    focusLevel={focusLevel}
                    nodeId={node.id}
                    onToggle={() => toggleExpandedNode(node.id)}
                    totalDescendantCount={branchStats?.totalDescendantCount ?? 0}
                  />
                </div>
              );
            })}
          </div>
        </div>
      ) : boardMarkdownContext ? (
        <GlobalAtlasBoard
          columns={globalBoardColumns}
          markdownContext={boardMarkdownContext}
          nodesById={nodesById}
          onOpenFull={openFullNode}
          onShowHistoryChange={setShowBoardHistory}
          registerNode={registerBoardNode}
          selectedNodeId={selectedNodeId}
          showHistory={showBoardHistory}
          snapshotEdges={snapshot.edges}
        />
      ) : null}

      {atlasView === 'map' &&
      edgeHover &&
      edgeHoverPosition &&
      edgeHoverSourceNode &&
      edgeHoverDirection &&
      edgeHoverTargetNode ? (
        <div
          className='pointer-events-auto fixed z-[70] max-w-[min(240px,calc(100vw-2rem))] rounded-full bg-background/72 px-2.5 py-1.5 text-xs shadow-[0_18px_54px_-34px_rgba(0,0,0,0.9)] backdrop-blur-xl'
          style={{
            left: edgeHoverPosition.left,
            top: edgeHoverPosition.top,
          }}
          onMouseEnter={clearEdgeHoverHideTimeout}
          onMouseLeave={scheduleEdgeHintHide}
        >
          <button
            type='button'
            className='group flex min-w-0 max-w-full items-center gap-2 text-left transition-colors hover:text-sky-300'
            onClick={focusEdgeTarget}
          >
            <span className='inline-flex shrink-0 items-center gap-1 font-mono text-[10px] uppercase tracking-wide text-muted-foreground'>
              <span className={cn('size-1.5 rounded-full', relationDotClassName(edgeHover.kind))} />
              {relationLabel(edgeHover.kind, edgeHoverDirection)}
            </span>
            <ArrowRight className='size-3 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-sky-300' />
            <span className='min-w-0 truncate font-medium text-foreground transition-colors group-hover:text-sky-300'>
              {edgeHoverTargetNode.shortTitle}
            </span>
          </button>
        </div>
      ) : null}

      <div className='pointer-events-none absolute inset-x-0 top-0 z-20 h-36 bg-gradient-to-b from-background/95 via-background/55 to-transparent' />

      <div className='pointer-events-auto absolute left-1/2 top-4 z-40 grid -translate-x-1/2 grid-cols-2 gap-1 rounded-lg border border-border/70 bg-background/78 p-1.5 shadow-lg backdrop-blur-xl'>
        {(
          [
            { icon: Network, label: 'Map', value: 'map' },
            { icon: Columns3, label: 'Board', value: 'board' },
          ] satisfies Array<{
            icon: typeof Network;
            label: string;
            value: AtlasView;
          }>
        ).map(item => {
          const Icon = item.icon;
          const active = atlasView === item.value;

          return (
            <button
              key={item.value}
              type='button'
              className={cn(
                'inline-flex h-9 min-w-24 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium transition-colors',
                active
                  ? 'bg-primary/12 text-foreground shadow-sm ring-1 ring-primary/45'
                  : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
              )}
              onClick={() => setAtlasView(item.value)}
            >
              <Icon className='size-4' />
              {item.label}
            </button>
          );
        })}
      </div>

      <button
        type='button'
        aria-label='Open Atlas search'
        title='Search Atlas (⌘K)'
        className='pointer-events-auto absolute left-4 top-4 z-40 rounded-lg border border-border/70 bg-background/78 px-3 py-2 text-sm font-semibold tracking-tight shadow-lg backdrop-blur-xl transition-colors hover:border-primary/45 hover:bg-background/90 focus:outline-none focus:ring-2 focus:ring-ring'
        onClick={() => setSearchOpen(true)}
      >
        Atlas
      </button>

      {searchOpen ? (
        <div
          className='pointer-events-auto absolute inset-0 z-[80] flex items-start justify-center bg-background/80 px-4 pt-[min(14vh,120px)] backdrop-blur-md'
          onMouseDown={event => {
            if (event.target !== event.currentTarget) {
              return;
            }

            setQuery('');
            setSearchOpen(false);
          }}
        >
          <section
            role='dialog'
            aria-label='Search Atlas'
            aria-modal='true'
            className='w-[min(680px,calc(100vw-2rem))] overflow-hidden rounded-xl border border-border/80 bg-background p-2 shadow-2xl'
          >
            <div className='relative'>
              <Search className='pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground' />
              <input
                ref={searchInputRef}
                aria-label='Search atlas'
                className='h-11 w-full rounded-lg border border-border/70 bg-background/75 pl-10 pr-16 text-sm outline-none ring-offset-background transition-shadow placeholder:text-muted-foreground focus:ring-2 focus:ring-ring'
                value={query}
                onChange={event => setQuery(event.target.value)}
                onKeyDown={event => {
                  if (event.key === 'Escape') {
                    event.preventDefault();
                    setQuery('');
                    setSearchOpen(false);
                    return;
                  }

                  if (event.key === 'Enter' && searchMatches[0]) {
                    event.preventDefault();
                    selectSearchMatch(searchMatches[0]);
                  }
                }}
                placeholder='Search Atlas'
              />
              <kbd className='pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded border border-border/80 bg-muted/75 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground'>
                ⌘K
              </kbd>
            </div>

            {query.trim() ? (
              <div className='mt-2 max-h-[min(60vh,560px)] overflow-y-auto rounded-lg p-1'>
                {searchMatches.length > 0 ? (
                  searchMatches.map(node => {
                    const sourceParts = getSearchSourceParts(node);
                    const planNumber = getPlanNumber(node);

                    return (
                      <button
                        key={node.id}
                        type='button'
                        className='grid w-full grid-cols-[auto_1fr] items-start gap-3 rounded-lg px-3 py-3 text-left transition-colors hover:bg-muted/70 focus:bg-muted/70 focus:outline-none'
                        title={sourceParts?.source}
                        onClick={() => selectSearchMatch(node)}
                      >
                        <span
                          className={cn(
                            'mt-1.5 size-2 rounded-full',
                            statusDotClassName(node.statusGroup),
                          )}
                        />
                        <span className='min-w-0'>
                          <span className='flex min-w-0 items-start gap-2'>
                            {planNumber ? (
                              <span className='shrink-0 rounded-md border border-primary/35 bg-primary/10 px-1.5 py-0.5 font-mono text-xs font-semibold leading-none text-primary'>
                                {planNumber}
                              </span>
                            ) : null}
                            <span className='line-clamp-2 text-sm font-medium leading-snug'>
                              {node.shortTitle}
                            </span>
                          </span>
                          <span className='mt-1.5 flex min-w-0 items-center gap-2 text-[10px] text-muted-foreground'>
                            <span className='shrink-0 font-mono uppercase'>{node.kind}</span>
                            {sourceParts?.scheme ? (
                              <span className='shrink-0 rounded border border-border/80 bg-muted/80 px-1.5 py-0.5 font-mono text-[9px] leading-none text-foreground/80'>
                                {sourceParts.scheme}
                              </span>
                            ) : null}
                            {sourceParts ? (
                              <span className='truncate font-mono'>{sourceParts.location}</span>
                            ) : null}
                          </span>
                        </span>
                      </button>
                    );
                  })
                ) : (
                  <div className='px-3 py-3 text-sm text-muted-foreground'>No matches</div>
                )}
              </div>
            ) : (
              <div className='px-3 py-5 text-center text-xs text-muted-foreground'>
                Search by title, type, status, or source URI
              </div>
            )}
          </section>
        </div>
      ) : null}

      {atlasView === 'map' ? (
        <div className='pointer-events-auto absolute right-4 top-4 z-40 flex items-center gap-2 rounded-lg border border-border/70 bg-background/78 p-2 shadow-lg backdrop-blur-xl max-sm:top-[72px] lg:right-[432px]'>
          {edgeFocusBackNode ? (
            <IconButton
              label={`Back to ${edgeFocusBackNode.shortTitle}`}
              onClick={focusEdgeBackNode}
            >
              <Undo2 className='size-4' />
            </IconButton>
          ) : null}
          <IconButton
            active={autoFocusEnabled}
            label={autoFocusEnabled ? 'Disable Auto Focus' : 'Enable Auto Focus'}
            onClick={() => setAutoFocusEnabled(current => !current)}
          >
            <Crosshair className='size-4' />
          </IconButton>
          <IconButton label='Reset Branches' onClick={resetBranches}>
            <BookOpen className='size-4' />
          </IconButton>
        </div>
      ) : null}

      <div className='pointer-events-auto absolute bottom-4 left-4 z-40 flex items-center gap-2 rounded-lg border border-border/70 bg-background/78 p-2 shadow-lg backdrop-blur-xl'>
        <IconButton label={themeToggleLabel} onClick={toggleTheme}>
          {themeToggleMounted ? (
            theme === 'light' ? (
              <Moon className='size-4' />
            ) : (
              <Sun className='size-4' />
            )
          ) : (
            <span className='size-4' aria-hidden='true' />
          )}
        </IconButton>
        {atlasView === 'map' ? (
          <>
            <IconButton label='Zoom out' onClick={() => zoomBy(-zoomButtonStep)}>
              <Minus className='size-4' />
            </IconButton>
            <IconButton label='Reset view' onClick={resetViewport}>
              <RotateCcw className='size-4' />
            </IconButton>
            <IconButton label='Zoom in' onClick={() => zoomBy(zoomButtonStep)}>
              <Plus className='size-4' />
            </IconButton>
          </>
        ) : null}
      </div>

      {atlasView === 'map' && selectedNode && !detailOpen ? (
        <div className='pointer-events-auto absolute bottom-4 right-4 z-40 rounded-lg border border-border/70 bg-background/78 p-2 shadow-lg backdrop-blur-xl'>
          <IconButton label='Open detail' onClick={() => setDetailOpen(true)}>
            <Info className='size-4' />
          </IconButton>
        </div>
      ) : null}

      {atlasView === 'map' && selectedNode && detailOpen ? (
        <SelectionPanel
          incoming={incoming}
          node={selectedNode}
          nodesById={nodesById}
          nodesByPath={nodesByPath}
          nodesBySemanticId={nodesBySemanticId}
          onClose={clearSelection}
          onOpenFull={openFullNode}
          onSelect={selectNode}
          outgoing={outgoing}
          semanticSignals={
            selectedNode.semanticId
              ? (semanticSignalsByTargetId.get(selectedNode.semanticId) ?? [])
              : []
          }
        />
      ) : null}

      {fullNode ? (
        <FullMarkdownModal
          activeTab={fullNodeActiveTab}
          edges={fullNodeEdges}
          evidence={snapshot.evidence ?? []}
          navigationBackNode={fullNodeNavigationBackNode}
          nodesById={nodesById}
          nodesByPath={nodesByPath}
          nodesBySemanticId={nodesBySemanticId}
          node={fullNode}
          onActiveTabChange={tab => setFullNodeActiveTab(fullNode.id, tab)}
          onClose={closeFullNode}
          onNavigateBack={navigateFullNodeBack}
          onOpenFull={openFullNode}
          semanticSignals={
            fullNode.semanticId ? (semanticSignalsByTargetId.get(fullNode.semanticId) ?? []) : []
          }
        />
      ) : null}
    </main>
  );
};
