import fs from 'node:fs';
import path from 'node:path';

import {
  loadAtlasSourceFiles,
  type AtlasMarkdownFile,
} from '../sources/markdown-source';
import {
  normalizeAtlasSourceRecord,
  resolveAtlasPlanReference,
  type NormalizedAtlasSourceRecord,
} from '../sources/normalized-source';
import type {
  PlanRelationKind,
  PlanStatusGroup,
  PlanWorkstreamEdge,
  PlanWorkstreamMetric,
  PlanWorkstreamNode,
  PlanWorkstreamSnapshot,
  PlanWorkstreamTerritory,
} from '../model/snapshot';

type PlanMarkdownFile = NormalizedAtlasSourceRecord;

export type ParsedPlan = {
  id: string;
  key: string;
  title: string;
  shortTitle: string;
  statusGroup: PlanStatusGroup;
  status: string;
  planKind?: string;
  scale?: string;
  horizon?: string;
  area?: string;
  codename?: string;
  territory: string;
  workstream: string;
  path: string;
  sourceFilePath?: string;
  href?: string;
  markdown: string;
  summary?: string;
  sections: string[];
  sourceId?: string;
  sourcePath: string;
  relatedLinks: Array<{ path: string; kind: Extract<PlanRelationKind, 'follow-up' | 'related'> }>;
  parentPlanPath?: string;
  candidateChildren: string[];
};

type AtlasItemKind = Extract<
  PlanWorkstreamNode['kind'],
  | 'project'
  | 'territory'
  | 'model'
  | 'concept'
  | 'experience'
  | 'capability'
  | 'entity'
  | 'operation'
  | 'artifact'
  | 'policy'
  | 'state'
  | 'relation'
  | 'system-primitive'
  | 'tooling'
  | 'evidence'
  | 'practice'
  | 'principle'
>;

export type ParsedAtlasItem = {
  id: string;
  nodeId: string;
  kind: AtlasItemKind;
  title: string;
  shortTitle: string;
  parent?: string;
  status: string;
  statusGroup: PlanStatusGroup;
  horizon?: string;
  supports: string[];
  relatedPlans: string[];
  exemplars: string[];
  path: string;
  sourceFilePath?: string;
  markdown: string;
  summary?: string;
  sections: string[];
  sourceId?: string;
  sourcePath: string;
  territory: string;
  workstream?: string;
};

type FrontmatterValue = string | string[];

const rootNodeId = 'root:planning';

const statusGroupOrder: Record<PlanStatusGroup, number> = {
  current: 0,
  next: 1,
  backlog: 2,
  research: 3,
  done: 4,
  unmaterialized: 5,
};

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/^-|-$/g, '')
    .slice(0, 80);

const getRepoRoot = () => {
  const cwd = process.cwd();

  if (
    fs.existsSync(path.join(cwd, 'package.json')) ||
    fs.existsSync(path.join(cwd, 'atlas.sources.local.yaml'))
  ) {
    return cwd;
  }

  return path.resolve(cwd, '..');
};

const titleFromHeading = (content: string, fallback: string) => {
  const heading = content.match(/^#\s+(.+)$/m)?.[1]?.trim();

  return heading || fallback;
};

const shortTitleFromTitle = (title: string) =>
  title
    .replace(/^\d+[a-z]?\.\s+/i, '')
    .replace(/^Plan\s+\d+[a-z]?:\s+/i, '')
    .trim();

const getPlanKey = (relativePath: string) => {
  const fileName = path.basename(relativePath, '.md');
  const keySource =
    fileName.toLowerCase() === 'readme' ? path.basename(path.dirname(relativePath)) : fileName;
  const keyMatch = keySource.match(/^(\d+[a-z]?)/i);

  return keyMatch?.[1] ?? keySource;
};

const getStatusGroup = (relativePath: string): PlanStatusGroup => {
  const parts = relativePath.split('/');
  const group = parts[1];

  if (
    group === 'current' ||
    group === 'next' ||
    group === 'backlog' ||
    group === 'research' ||
    group === 'done'
  ) {
    return group;
  }

  return 'backlog';
};

const parseMetadata = (content: string) => {
  const metadata: Record<string, string> = {};
  const lines = content.replaceAll('\r\n', '\n').split('\n');
  const titleLineIndex = lines.findIndex(line => /^#\s+/.test(line.trim()));
  let metadataStartIndex = titleLineIndex >= 0 ? titleLineIndex + 1 : 0;

  while (metadataStartIndex < lines.length && !(lines[metadataStartIndex] ?? '').trim()) {
    metadataStartIndex += 1;
  }

  for (const line of lines.slice(metadataStartIndex)) {
    const trimmed = line.trim();

    if (!trimmed) {
      break;
    }

    const match = trimmed.match(/^([A-Za-z][A-Za-z0-9\s-]*):\s*(.+)$/);
    if (!match) {
      break;
    }

    metadata[match[1].toLowerCase().replaceAll(/\s+/g, '-')] = match[2].trim();
  }

  return metadata;
};

const parseFrontmatter = (content: string) => {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?/);

  if (!match) {
    return {
      body: content,
      metadata: {} as Record<string, FrontmatterValue>,
    };
  }

  const metadata: Record<string, FrontmatterValue> = {};
  let currentListKey: string | null = null;

  for (const line of match[1]?.split('\n') ?? []) {
    const listItem = line.match(/^\s+-\s+(.+)$/);

    if (listItem && currentListKey) {
      const currentValue = metadata[currentListKey];
      const currentList = Array.isArray(currentValue) ? currentValue : [];
      metadata[currentListKey] = [...currentList, listItem[1]?.trim() ?? ''];
      continue;
    }

    const keyValue = line.match(/^([A-Za-z][A-Za-z0-9-]*):(?:\s*(.*))?$/);

    if (!keyValue) {
      currentListKey = null;
      continue;
    }

    const key = keyValue[1];
    const rawValue = keyValue[2]?.trim() ?? '';
    const value = rawValue === '[]' ? [] : rawValue;
    currentListKey = key;
    metadata[key] = value;
  }

  return {
    body: content.slice(match[0].length),
    metadata,
  };
};

const getFrontmatterString = (
  metadata: Record<string, FrontmatterValue>,
  key: string,
  fallback = '',
) => {
  const value = metadata[key];

  return typeof value === 'string' ? value : fallback;
};

const getFrontmatterList = (metadata: Record<string, FrontmatterValue>, key: string) => {
  const value = metadata[key];

  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }

  return typeof value === 'string' && value ? [value] : [];
};

const getSectionText = (content: string, sectionTitle: string) => {
  const escapedTitle = sectionTitle.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = content.match(
    new RegExp(`(?:^|\\n)##\\s+${escapedTitle}\\s*\\n([\\s\\S]*?)(?=\\n##\\s+|$)`, 'i'),
  );

  return match?.[1]?.trim();
};

const getSummary = (content: string) => {
  const summarySection = getSectionText(content, 'Summary');

  if (!summarySection) {
    return undefined;
  }

  const paragraph = summarySection
    .split(/\n\s*\n/)
    .map(part => part.replaceAll(/\s+/g, ' ').trim())
    .find(Boolean);

  return paragraph?.slice(0, 360);
};

const parseSections = (content: string) =>
  [...content.matchAll(/^##\s+(.+)$/gm)].map(match => match[1]?.trim()).filter(Boolean) as string[];

const humanizeIdentifier = (value: string) =>
  value
    .replaceAll(/[-_]+/g, ' ')
    .replaceAll(/\b\w/g, character => character.toUpperCase());

const resolvePlanLink = (file: PlanMarkdownFile, href: string) =>
  resolveAtlasPlanReference(file, href, { relativeTo: 'record' });

const parseRelatedLinks = (file: PlanMarkdownFile) => {
  const lines = file.content.split('\n');
  const linksByPath = new Map<string, ParsedPlan['relatedLinks'][number]>();
  let insideChildPlansSection = false;
  let activeSection = '';

  const upsertLink = (link: ParsedPlan['relatedLinks'][number]) => {
    const existingLink = linksByPath.get(link.path);

    if (!existingLink || link.kind === 'follow-up') {
      linksByPath.set(link.path, link);
    }
  };

  for (const line of lines) {
    const trimmedLine = line.trim();
    const heading = trimmedLine.match(/^##\s+(.+?)\s*$/);

    if (heading) {
      activeSection = heading[1]?.toLowerCase() ?? '';
    }

    if (/^##\s+Child Plans\s*$/i.test(trimmedLine)) {
      insideChildPlansSection = true;
      continue;
    }

    if (insideChildPlansSection && /^##\s+/.test(trimmedLine)) {
      insideChildPlansSection = false;
    }

    if (insideChildPlansSection || /^Parent plan:/i.test(trimmedLine)) {
      continue;
    }

    for (const match of line.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
      const resolvedPath = match[1] ? resolvePlanLink(file, match[1]) : undefined;

      if (!resolvedPath) {
        continue;
      }

      upsertLink({
        path: resolvedPath,
        kind: /closure|evolution|follow.?up/i.test(activeSection) ? 'follow-up' : 'related',
      });
    }
  }

  return [...linksByPath.values()];
};

const parseParentPlanPath = (file: PlanMarkdownFile) => {
  const parentPlanLine = file.content.split('\n').find(line => /^Parent plan:/i.test(line.trim()));
  const href = parentPlanLine?.match(/\[[^\]]+\]\(([^)]+)\)/)?.[1];

  return href ? resolvePlanLink(file, href) : undefined;
};

const parseCandidateChildren = (content: string) => {
  const hierarchySection = getSectionText(content, 'Plan Hierarchy Experiment');

  if (!hierarchySection) {
    return [];
  }

  const candidateBlock = hierarchySection.match(
    /Candidate child plans:\s*([\s\S]*?)(?=\n\n[A-Z][^\n]+:|\n##\s+|$)/,
  )?.[1];

  if (!candidateBlock) {
    return [];
  }

  return candidateBlock
    .split('\n')
    .map(line =>
      line
        .trim()
        .match(/^\d+\.\s+(.+)$/)?.[1]
        ?.trim(),
    )
    .filter(Boolean) as string[];
};

const parsePlan = (file: PlanMarkdownFile): ParsedPlan => {
  const title = titleFromHeading(file.content, path.basename(file.sourcePath, '.md'));
  const metadata = parseMetadata(file.content);
  const key = getPlanKey(file.sourcePath);
  const shortTitle = shortTitleFromTitle(title);
  const statusGroup = getStatusGroup(file.sourcePath);
  const planKind = metadata['plan-kind'];
  const area = metadata.area;
  const codename = metadata.codename;
  const territory =
    metadata.territory ?? (file.sourceId ? humanizeIdentifier(file.sourceId) : 'Plans');
  const workstream = metadata.workstream ?? codename ?? humanizeIdentifier(statusGroup);

  return {
    id: `plan:${file.canonicalPath}`,
    key,
    title,
    shortTitle,
    statusGroup,
    status: metadata.status ?? statusGroup,
    planKind,
    scale: metadata.scale,
    horizon: metadata.horizon,
    area,
    codename,
    territory,
    workstream,
    path: file.canonicalPath,
    sourceFilePath: file.sourceFilePath,
    href: undefined,
    markdown: file.content,
    summary: getSummary(file.content),
    sections: parseSections(file.content),
    sourceId: file.sourceId,
    sourcePath: file.sourcePath,
    relatedLinks: parseRelatedLinks(file),
    parentPlanPath: parseParentPlanPath(file),
    candidateChildren: parseCandidateChildren(file.content),
  };
};

const isAtlasItemKind = (value: string): value is AtlasItemKind =>
  value === 'project' ||
  value === 'territory' ||
  value === 'model' ||
  value === 'concept' ||
  value === 'experience' ||
  value === 'capability' ||
  value === 'entity' ||
  value === 'operation' ||
  value === 'artifact' ||
  value === 'policy' ||
  value === 'state' ||
  value === 'relation' ||
  value === 'system-primitive' ||
  value === 'tooling' ||
  value === 'evidence' ||
  value === 'practice' ||
  value === 'principle';

const getAtlasStatusGroup = (input: { horizon?: string; status: string }): PlanStatusGroup => {
  const status = input.status.toLowerCase();
  const horizon = input.horizon?.toLowerCase();

  if (status === 'done') {
    return 'done';
  }

  if (status === 'idea') {
    return 'unmaterialized';
  }

  if (status === 'in-progress') {
    return 'current';
  }

  if (status === 'shaping') {
    if (horizon === 'later') {
      return 'backlog';
    }

    return horizon === 'now' ? 'current' : 'next';
  }

  return 'backlog';
};

const getBodySummary = (content: string) => {
  const summarySection = getSummary(content);

  if (summarySection) {
    return summarySection;
  }

  return content
    .split(/\n\s*\n/)
    .map(part => part.replaceAll(/\s+/g, ' ').trim())
    .find(part => part && !part.startsWith('#') && !part.startsWith('---'))
    ?.slice(0, 360);
};

const parseAtlasItem = (file: PlanMarkdownFile): ParsedAtlasItem | null => {
  const { body, metadata } = parseFrontmatter(file.content);
  const id = getFrontmatterString(metadata, 'id');

  if (!id) {
    return null;
  }

  const kindSource = getFrontmatterString(metadata, 'kind', 'capability');
  const kind = isAtlasItemKind(kindSource) ? kindSource : 'capability';
  const title = getFrontmatterString(metadata, 'title', titleFromHeading(body, id));
  const status = getFrontmatterString(metadata, 'status', 'shaping');
  const horizon = getFrontmatterString(metadata, 'horizon') || undefined;

  return {
    id,
    nodeId: `atlas:${id}`,
    kind,
    title,
    shortTitle: shortTitleFromTitle(title),
    parent: getFrontmatterString(metadata, 'parent') || undefined,
    status,
    statusGroup: getAtlasStatusGroup({ horizon, status }),
    horizon,
    supports: getFrontmatterList(metadata, 'supports'),
    relatedPlans: getFrontmatterList(metadata, 'relatedPlans').flatMap(reference => {
      const resolvedReference = resolveAtlasPlanReference(file, reference);

      return resolvedReference ? [resolvedReference] : [];
    }),
    exemplars: getFrontmatterList(metadata, 'exemplars'),
    path: file.canonicalPath,
    sourceFilePath: file.sourceFilePath,
    markdown: file.content,
    summary: getBodySummary(body),
    sections: parseSections(body),
    sourceId: file.sourceId,
    sourcePath: file.sourcePath,
    territory: title,
  };
};

export type ParsedAtlasSource = {
  items: ParsedAtlasItem[];
  plans: ParsedPlan[];
};

export const parseAtlasSourceRecords = (
  records: NormalizedAtlasSourceRecord[],
): ParsedAtlasSource => ({
  plans: records
    .filter(
      record =>
        record.sourcePath.startsWith('plans/') &&
        record.sourcePath !== 'plans/README.md' &&
        record.sourcePath !== 'plans/done/README.md' &&
        record.sourcePath !== 'plans/research/README.md',
    )
    .map(parsePlan),
  items: [
    ...new Map(
      records
        .filter(record => record.sourcePath.startsWith('atlas/items/'))
        .map(parseAtlasItem)
        .filter((item): item is ParsedAtlasItem => Boolean(item))
        .map(item => [item.id, item] as const),
    ).values(),
  ],
});

const toPlanNode = (plan: ParsedPlan): PlanWorkstreamNode => ({
  id: plan.id,
  kind: 'plan',
  title: plan.title,
  shortTitle: plan.shortTitle,
  statusGroup: plan.statusGroup,
  status: plan.status,
  planKind: plan.planKind,
  scale: plan.scale,
  horizon: plan.horizon,
  area: plan.area,
  codename: plan.codename,
  territory: plan.territory,
  workstream: plan.workstream,
  path: plan.path,
  sourceFilePath: plan.sourceFilePath,
  href: plan.href,
  markdown: plan.markdown,
  summary: plan.summary,
  sections: plan.sections,
  relatedCount: 0,
  candidateCount: plan.candidateChildren.length,
});

const toAtlasNode = (item: ParsedAtlasItem): PlanWorkstreamNode => ({
  id: item.nodeId,
  kind: item.kind,
  title: item.title,
  shortTitle: item.shortTitle,
  statusGroup: item.statusGroup,
  status: item.status,
  horizon: item.horizon,
  semanticId: item.id,
  territory: item.territory,
  workstream: item.workstream,
  path: item.path,
  sourceFilePath: item.sourceFilePath,
  markdown: item.markdown,
  summary: item.summary,
  sections: item.sections,
  exemplars: item.exemplars,
  relatedCount: 0,
  candidateCount: 0,
});

const getNodeStatusActive = (node: PlanWorkstreamNode) =>
  node.statusGroup === 'current' || node.statusGroup === 'next' || node.statusGroup === 'research';

const buildMetrics = (nodes: PlanWorkstreamNode[]): PlanWorkstreamMetric[] => {
  const planNodes = nodes.filter(node => node.kind === 'plan');
  const workstreamNodes = nodes.filter(node => node.kind === 'workstream');
  const activeNodes = planNodes.filter(getNodeStatusActive);
  const candidateNodes = nodes.filter(node => node.kind === 'candidate');

  return [
    { label: 'plans', value: String(planNodes.length) },
    { label: 'workstreams', value: String(workstreamNodes.length) },
    { label: 'active leaves', value: String(activeNodes.length) },
    { label: 'unmaterialized', value: String(candidateNodes.length) },
  ];
};

const sortNodes = (nodes: PlanWorkstreamNode[]) =>
  [...nodes].sort((left, right) => {
    const territoryDelta = left.territory.localeCompare(right.territory);

    if (territoryDelta !== 0) {
      return territoryDelta;
    }

    const statusDelta = statusGroupOrder[left.statusGroup] - statusGroupOrder[right.statusGroup];

    if (statusDelta !== 0) {
      return statusDelta;
    }

    const workstreamDelta = (left.workstream ?? '').localeCompare(right.workstream ?? '');

    if (workstreamDelta !== 0) {
      return workstreamDelta;
    }

    return left.shortTitle.localeCompare(right.shortTitle);
  });

const buildSemanticMetrics = (nodes: PlanWorkstreamNode[]): PlanWorkstreamMetric[] => {
  const itemNodes = nodes.filter(
    node => node.kind !== 'root' && node.kind !== 'plan' && node.kind !== 'candidate',
  );
  const projectNodes = itemNodes.filter(node => node.kind === 'project');
  const planNodes = nodes.filter(node => node.kind === 'plan');
  const activeNodes = itemNodes.filter(getNodeStatusActive);

  return [
    { label: 'items', value: String(itemNodes.length) },
    { label: 'projects', value: String(projectNodes.length) },
    { label: 'linked plans', value: String(planNodes.length) },
    { label: 'active', value: String(activeNodes.length) },
  ];
};

const getAtlasRoot = (item: ParsedAtlasItem, itemById: Map<string, ParsedAtlasItem>) => {
  let current = item;
  const visited = new Set<string>();

  while (current.parent && !visited.has(current.id)) {
    visited.add(current.id);
    const parent = itemById.get(current.parent);

    if (!parent) {
      break;
    }

    current = parent;
  }

  return current;
};

const getAtlasDepth = (item: ParsedAtlasItem, itemById: Map<string, ParsedAtlasItem>) => {
  let depth = 0;
  let current: ParsedAtlasItem | undefined = item;
  const visited = new Set<string>();

  while (current?.parent && !visited.has(current.id)) {
    visited.add(current.id);
    current = itemById.get(current.parent);
    depth += 1;
  }

  return depth;
};

const buildAtlasItemOrder = (items: ParsedAtlasItem[]) => {
  const itemById = new Map(items.map(item => [item.id, item]));
  const childrenByParent = new Map<string, ParsedAtlasItem[]>();
  const rootItems: ParsedAtlasItem[] = [];

  for (const item of items) {
    if (!item.parent || !itemById.has(item.parent)) {
      rootItems.push(item);
      continue;
    }

    childrenByParent.set(item.parent, [...(childrenByParent.get(item.parent) ?? []), item]);
  }

  const byPath = (left: ParsedAtlasItem, right: ParsedAtlasItem) =>
    left.path.localeCompare(right.path);
  rootItems.sort(byPath);

  for (const [parent, children] of childrenByParent) {
    childrenByParent.set(parent, [...children].sort(byPath));
  }

  const ordered: ParsedAtlasItem[] = [];
  const visit = (item: ParsedAtlasItem) => {
    ordered.push(item);

    for (const child of childrenByParent.get(item.id) ?? []) {
      visit(child);
    }
  };

  for (const root of rootItems) {
    visit(root);
  }

  return ordered;
};

const hasAtlasContainmentPath = (
  fromItemId: string,
  toItemId: string,
  itemById: Map<string, ParsedAtlasItem>,
) => {
  let current = itemById.get(fromItemId);
  const visited = new Set<string>();

  while (current?.parent && !visited.has(current.id)) {
    if (current.parent === toItemId) {
      return true;
    }

    visited.add(current.id);
    current = itemById.get(current.parent);
  }

  return false;
};

const isRedundantAtlasSupport = (
  fromItemId: string,
  toItemId: string,
  itemById: Map<string, ParsedAtlasItem>,
) =>
  hasAtlasContainmentPath(fromItemId, toItemId, itemById) ||
  hasAtlasContainmentPath(toItemId, fromItemId, itemById);

const hasDescendantRelatedPlan = (
  itemId: string,
  planPath: string,
  items: ParsedAtlasItem[],
  itemById: Map<string, ParsedAtlasItem>,
) =>
  items.some(
    item =>
      item.id !== itemId &&
      item.relatedPlans.includes(planPath) &&
      hasAtlasContainmentPath(item.id, itemId, itemById),
  );

const getPlanReferences = (plan: ParsedPlan) => [plan.path];

const buildSemanticSnapshotFromFiles = (
  planFiles: PlanMarkdownFile[],
  atlasFiles: PlanMarkdownFile[],
): PlanWorkstreamSnapshot => {
  const { plans, items: rawAtlasItems } = parseAtlasSourceRecords([
    ...planFiles,
    ...atlasFiles,
  ]);
  const planByPath = new Map(
    plans.flatMap(plan => getPlanReferences(plan).map(reference => [reference, plan] as const)),
  );
  const rawItemById = new Map(rawAtlasItems.map(item => [item.id, item]));
  const atlasItems = rawAtlasItems.map(item => {
    const root = getAtlasRoot(item, rawItemById);
    const parent = item.parent ? rawItemById.get(item.parent) : undefined;
    const depth = getAtlasDepth(item, rawItemById);

    return {
      ...item,
      territory: root.title,
      workstream: depth > 1 ? parent?.title : undefined,
    };
  });
  const itemById = new Map(atlasItems.map(item => [item.id, item]));
  const nodeById = new Map<string, PlanWorkstreamNode>();
  const edges: PlanWorkstreamEdge[] = [];
  const edgeIds = new Set<string>();
  const referencedPlanPaths = new Set(atlasItems.flatMap(item => item.relatedPlans));
  const isReferencedPlan = (plan: ParsedPlan) =>
    getPlanReferences(plan).some(reference => referencedPlanPaths.has(reference));
  const orderedPlans: ParsedPlan[] = [];
  const orderedPlanPaths = new Set<string>();
  const addEdge = (edge: PlanWorkstreamEdge) => {
    if (edgeIds.has(edge.id)) {
      return;
    }

    edgeIds.add(edge.id);
    edges.push(edge);
  };
  const addNode = (node: PlanWorkstreamNode) => {
    if (nodeById.has(node.id)) {
      return;
    }

    nodeById.set(node.id, node);
  };

  addNode({
    id: rootNodeId,
    kind: 'root',
    title: 'Atlas',
    shortTitle: 'Atlas',
    statusGroup: 'current',
    status: 'semantic map',
    territory: 'Atlas',
    sections: [],
    relatedCount: 0,
    candidateCount: 0,
  });

  for (const item of buildAtlasItemOrder(atlasItems)) {
    addNode(toAtlasNode(item));
    addEdge({
      id: `${item.parent ? `atlas:${item.parent}` : rootNodeId}->${item.nodeId}:contains`,
      from: item.parent ? `atlas:${item.parent}` : rootNodeId,
      to: item.nodeId,
      kind: 'contains',
    });

    for (const planPath of item.relatedPlans) {
      if (hasDescendantRelatedPlan(item.id, planPath, atlasItems, itemById)) {
        continue;
      }

      const plan = planByPath.get(planPath);

      if (!plan) {
        continue;
      }

      if (!orderedPlanPaths.has(plan.path)) {
        orderedPlanPaths.add(plan.path);
        orderedPlans.push(plan);
      }

      addEdge({
        id: `${item.nodeId}->${plan.id}:shaped-by`,
        from: item.nodeId,
        to: plan.id,
        kind: 'shaped-by',
      });
    }
  }

  for (const plan of orderedPlans.sort((left, right) => left.path.localeCompare(right.path))) {
    addNode(toPlanNode(plan));
  }

  for (const item of atlasItems) {
    for (const supportedItemId of item.supports) {
      if (supportedItemId === item.id || !itemById.has(supportedItemId)) {
        continue;
      }

      if (isRedundantAtlasSupport(item.id, supportedItemId, itemById)) {
        continue;
      }

      addEdge({
        id: `${item.nodeId}->atlas:${supportedItemId}:supports`,
        from: item.nodeId,
        to: `atlas:${supportedItemId}`,
        kind: 'supports',
      });
    }
  }

  for (const plan of orderedPlans) {
    if (plan.parentPlanPath) {
      const parentPlan = planByPath.get(plan.parentPlanPath);

      if (parentPlan && isReferencedPlan(parentPlan)) {
        addEdge({
          id: `${parentPlan.id}->${plan.id}:contains`,
          from: parentPlan.id,
          to: plan.id,
          kind: 'contains',
        });
      }
    }

    for (const link of plan.relatedLinks) {
      const target = planByPath.get(link.path);

      if (!target || !isReferencedPlan(target)) {
        continue;
      }

      addEdge({
        id: `${plan.id}->${target.id}:${link.kind}`,
        from: plan.id,
        to: target.id,
        kind: link.kind,
      });
    }
  }

  const nodes = [...nodeById.values()];
  const nodeStats = new Map<string, Pick<PlanWorkstreamNode, 'candidateCount' | 'relatedCount'>>();

  for (const node of nodes) {
    nodeStats.set(node.id, {
      candidateCount: node.candidateCount,
      relatedCount: 0,
    });
  }

  for (const edge of edges) {
    const stats = nodeStats.get(edge.from);

    if (!stats) {
      continue;
    }

    if (
      edge.kind === 'follow-up' ||
      edge.kind === 'related' ||
      edge.kind === 'shaped-by' ||
      edge.kind === 'supports'
    ) {
      stats.relatedCount += 1;
    }
  }

  const nodesWithStats = nodes.map(node => ({
    ...node,
    ...nodeStats.get(node.id),
  }));
  const rootItems = atlasItems.filter(item => !item.parent || !itemById.has(item.parent));
  const territories: PlanWorkstreamTerritory[] = rootItems.map(item => {
    const itemNodes = nodesWithStats.filter(
      node => node.id === item.nodeId || node.territory === item.title,
    );

    return {
      id: item.nodeId,
      title: item.title,
      nodeCount: itemNodes.length,
      activeCount: itemNodes.filter(getNodeStatusActive).length,
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    metrics: buildSemanticMetrics(nodesWithStats),
    territories,
    nodes: nodesWithStats,
    documents: plans.map(toPlanNode),
    edges,
  };
};

export const buildPlanWorkstreamSnapshotFromFiles = (
  files: AtlasMarkdownFile[],
  atlasFiles: AtlasMarkdownFile[] = [],
): PlanWorkstreamSnapshot => {
  const normalizedFiles = files.map(normalizeAtlasSourceRecord);
  const normalizedAtlasFiles = atlasFiles.map(normalizeAtlasSourceRecord);

  if (atlasFiles.length > 0) {
    return buildSemanticSnapshotFromFiles(normalizedFiles, normalizedAtlasFiles);
  }

  const plans = normalizedFiles
    .filter(
      file =>
        file.sourcePath !== 'plans/README.md' &&
        file.sourcePath !== 'plans/done/README.md' &&
        file.sourcePath !== 'plans/research/README.md',
    )
    .map(parsePlan);
  const planByPath = new Map(plans.map(plan => [plan.path, plan]));
  const territoryNames = new Set(plans.map(plan => plan.territory));
  const workstreams = new Map(
    plans.map(plan => [`${plan.territory}:${plan.workstream}`, plan] as const),
  );
  const nodes: PlanWorkstreamNode[] = [
    {
      id: rootNodeId,
      kind: 'root',
      title: 'Planning',
      shortTitle: 'Planning',
      statusGroup: 'current',
      status: 'planning surface',
      territory: 'Plans',
      sections: [],
      relatedCount: 0,
      candidateCount: 0,
    },
  ];
  const edges: PlanWorkstreamEdge[] = [];
  const edgeIds = new Set<string>();
  const addEdge = (edge: PlanWorkstreamEdge) => {
    if (edgeIds.has(edge.id)) {
      return;
    }

    edgeIds.add(edge.id);
    edges.push(edge);
  };

  for (const territory of [...territoryNames].sort((left, right) => left.localeCompare(right))) {
    const territoryId = `territory:${slugify(territory)}`;
    nodes.push({
      id: territoryId,
      kind: 'territory',
      title: territory,
      shortTitle: territory,
      statusGroup: 'current',
      status: 'territory',
      territory,
      sections: [],
      relatedCount: 0,
      candidateCount: 0,
    });
    addEdge({
      id: `${rootNodeId}->${territoryId}`,
      from: rootNodeId,
      to: territoryId,
      kind: 'contains',
    });
  }

  for (const [key, plan] of workstreams) {
    const workstreamId = `workstream:${slugify(key)}`;
    const territoryId = `territory:${slugify(plan.territory)}`;

    nodes.push({
      id: workstreamId,
      kind: 'workstream',
      title: plan.workstream,
      shortTitle: plan.workstream,
      statusGroup: 'current',
      status: 'workstream',
      territory: plan.territory,
      workstream: plan.workstream,
      sections: [],
      relatedCount: 0,
      candidateCount: 0,
    });
    addEdge({
      id: `${territoryId}->${workstreamId}`,
      from: territoryId,
      to: workstreamId,
      kind: 'contains',
    });
  }

  for (const plan of plans) {
    const workstreamId = `workstream:${slugify(`${plan.territory}:${plan.workstream}`)}`;
    nodes.push(toPlanNode(plan));
    addEdge({
      id: `${workstreamId}->${plan.id}`,
      from: workstreamId,
      to: plan.id,
      kind: 'contains',
    });

    for (const childTitle of plan.candidateChildren) {
      const childId = `candidate:${plan.key}:${slugify(childTitle)}`;
      nodes.push({
        id: childId,
        kind: 'candidate',
        title: childTitle,
        shortTitle: childTitle,
        statusGroup: 'unmaterialized',
        status: 'not materialized',
        territory: plan.territory,
        workstream: plan.workstream,
        sections: [],
        relatedCount: 0,
        candidateCount: 0,
      });
      addEdge({
        id: `${plan.id}->${childId}`,
        from: plan.id,
        to: childId,
        kind: 'candidate',
      });
    }
  }

  for (const plan of plans) {
    if (plan.parentPlanPath) {
      const parentPlan = planByPath.get(plan.parentPlanPath);

      if (parentPlan) {
        addEdge({
          id: `${parentPlan.id}->${plan.id}:contains`,
          from: parentPlan.id,
          to: plan.id,
          kind: 'contains',
        });
      }
    }

    for (const link of plan.relatedLinks) {
      const target = planByPath.get(link.path);

      if (!target) {
        continue;
      }

      addEdge({
        id: `${plan.id}->${target.id}:${link.kind}`,
        from: plan.id,
        to: target.id,
        kind: link.kind,
      });
    }
  }

  const nodeStats = new Map<string, Pick<PlanWorkstreamNode, 'candidateCount' | 'relatedCount'>>();
  for (const node of nodes) {
    nodeStats.set(node.id, {
      candidateCount: node.candidateCount,
      relatedCount: 0,
    });
  }

  for (const edge of edges) {
    const stats = nodeStats.get(edge.from);

    if (!stats) {
      continue;
    }

    if (edge.kind === 'follow-up' || edge.kind === 'related') {
      stats.relatedCount += 1;
    }
  }

  const nodesWithStats = nodes.map(node => ({
    ...node,
    ...nodeStats.get(node.id),
  }));
  const territories: PlanWorkstreamTerritory[] = [...territoryNames]
    .sort((left, right) => left.localeCompare(right))
    .map(name => {
      const territoryNodes = nodesWithStats.filter(
        node => node.kind === 'plan' && node.territory === name,
      );

      return {
        id: `territory:${slugify(name)}`,
        title: name,
        nodeCount: territoryNodes.length,
        activeCount: territoryNodes.filter(getNodeStatusActive).length,
      };
    });

  return {
    generatedAt: new Date().toISOString(),
    metrics: buildMetrics(nodesWithStats),
    territories,
    nodes: sortNodes(nodesWithStats),
    edges,
  };
};

export const getPlanWorkstreamSnapshot = async (): Promise<PlanWorkstreamSnapshot> => {
  const repoRoot = getRepoRoot();
  let sourceFiles: AtlasMarkdownFile[] = [];

  try {
    sourceFiles = await loadAtlasSourceFiles({ repoRoot });
  } catch (error) {
    process.stderr.write(
      `Failed to load external Atlas sources: ${error instanceof Error ? error.message : String(error)}\n`,
    );
  }

  return buildPlanWorkstreamSnapshotFromFiles(
    sourceFiles.filter(file => file.path.startsWith('plans/')),
    sourceFiles.filter(file => file.path.startsWith('atlas/items/')),
  );
};
