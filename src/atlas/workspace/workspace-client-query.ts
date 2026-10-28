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
  role: field.enum(['owner', 'editor', 'viewer']),
  status: field.enum(['active', 'suspended']),
}).belongsTo('user', AtlasUserSchema, { via: 'userId' });

const AtlasWorkspaceSchema = defineEntitySchema('AtlasWorkspace', {
  id: field.id(),
  slug: field.nonEmptyString({ trim: true }),
  name: field.nonEmptyString({ trim: true }),
  visibility: field.enum(['private', 'public']),
}).hasMany('memberships', AtlasWorkspaceMembershipSchema, { via: 'workspaceId' });

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
