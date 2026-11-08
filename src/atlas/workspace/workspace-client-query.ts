'use client';

import {
  defineClientEntity,
  entity as defineEntitySchema,
  field,
} from '@ontahi/core/data-graph';

const AtlasUserSchema = defineEntitySchema('AtlasUser', {
  id: field.id(),
  name: field.nonEmptyString({ trim: true }),
  email: field.nonEmptyString({ trim: true }),
  image: field.nullable(field.string()),
});

const AtlasWorkspaceMembershipSchema = defineEntitySchema('AtlasWorkspaceMembership', {
  id: field.id(),
  workspaceId: field.id(),
  userId: field.id(),
  role: field.enum(['owner', 'collaborator', 'viewer']),
  status: field.enum(['active', 'suspended']),
}).belongsTo('user', AtlasUserSchema, { via: 'userId' });

const AtlasWorkspaceSchema = defineEntitySchema('AtlasWorkspace', {
  id: field.id(),
  slug: field.nonEmptyString({ trim: true }),
  name: field.nonEmptyString({ trim: true }),
  visibility: field.enum(['private', 'public']),
}).hasMany('memberships', AtlasWorkspaceMembershipSchema, { via: 'workspaceId' });

const AtlasWorkspaceSourceSchema = defineEntitySchema('AtlasWorkspaceSource', {
  id: field.id(),
  workspaceId: field.id(),
  sourceId: field.nonEmptyString({ trim: true }),
  provider: field.enum(['github', 'local']),
  repository: field.nullable(field.string()),
  ref: field.nonEmptyString({ trim: true }),
  status: field.enum(['active', 'paused']),
  contributorAccess: field.enum(['off', 'approval-required', 'automatic-viewer']),
});

const AtlasWorkspaceContributorSchema = defineEntitySchema('AtlasWorkspaceContributor', {
  id: field.id(),
  workspaceId: field.id(),
  workspaceSourceId: field.id(),
  sourceId: field.nonEmptyString({ trim: true }),
  provider: field.enum(['github']),
  providerAccountId: field.nonEmptyString({ trim: true }),
  login: field.nonEmptyString({ trim: true }),
  avatarUrl: field.nullable(field.string()),
  kind: field.enum(['person', 'bot']),
  contributionCount: field.number(),
  lastContributedAt: field.nonEmptyString({ trim: true }),
  linkedUserId: field.nullable(field.id()),
});

const AtlasWorkspaceSourceImportSchema = defineEntitySchema('AtlasWorkspaceSourceImport', {
  id: field.id(),
  workspaceId: field.id(),
  triggerSourceId: field.nullable(field.id()),
  trigger: field.enum(['connection', 'manual', 'push', 'pull-request', 'source-removal']),
  providerDeliveryId: field.nullable(field.string()),
  triggerRevision: field.nullable(field.string()),
  pullRequestNumber: field.nullable(field.number()),
  repository: field.nullable(field.string()),
  observedRevision: field.nullable(field.string()),
  status: field.enum([
    'pending',
    'running',
    'completed',
    'failed',
    'cancel-requested',
    'compensating',
    'cancelled',
  ]),
  startedAt: field.nonEmptyString({ trim: true }),
  completedAt: field.nullable(field.string()),
  error: field.nullable(field.string()),
  diagnosticsJson: field.string(),
});

const Workspace = defineClientEntity(AtlasWorkspaceSchema);
const WorkspaceSettings = Workspace.view('AtlasWorkspaceSettings', {
  id: true,
  slug: true,
  name: true,
  visibility: true,
});

const Membership = defineClientEntity(AtlasWorkspaceMembershipSchema);
const WorkspaceMember = Membership.view('AtlasWorkspaceMember', {
  id: true,
  userId: true,
  role: true,
  status: true,
  user: {
    id: true,
    name: true,
    email: true,
    image: true,
  },
});

export const workspaceSettingsQuery = Workspace.all().as(WorkspaceSettings).limit(1);
export const workspaceMembersQuery = Membership.all().as(WorkspaceMember).limit(100);

const Source = defineClientEntity(AtlasWorkspaceSourceSchema);
const WorkspaceSource = Source.view('AtlasWorkspaceSourceSettings', {
  id: true,
  sourceId: true,
  provider: true,
  repository: true,
  ref: true,
  status: true,
  contributorAccess: true,
});

export const workspaceSourcesQuery = Source.all().as(WorkspaceSource).limit(100);

const Contributor = defineClientEntity(AtlasWorkspaceContributorSchema);
const WorkspaceContributor = Contributor.view('AtlasWorkspaceContributorSettings', {
  id: true,
  sourceId: true,
  provider: true,
  providerAccountId: true,
  login: true,
  avatarUrl: true,
  kind: true,
  contributionCount: true,
  lastContributedAt: true,
  linkedUserId: true,
});

export const workspaceContributorsQuery = Contributor.all()
  .as(WorkspaceContributor)
  .limit(200);

const SourceImport = defineClientEntity(AtlasWorkspaceSourceImportSchema);
const WorkspaceSourceImport = SourceImport.view('AtlasWorkspaceSourceImportSettings', {
  id: true,
  triggerSourceId: true,
  trigger: true,
  providerDeliveryId: true,
  triggerRevision: true,
  pullRequestNumber: true,
  repository: true,
  observedRevision: true,
  status: true,
  startedAt: true,
  completedAt: true,
  error: true,
  diagnosticsJson: true,
});

export const workspaceSourceImportsQuery = SourceImport.all()
  .as(WorkspaceSourceImport)
  .orderBy(sourceImport => sourceImport.startedAt.desc())
  .limit(50);
