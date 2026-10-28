import { field } from '@ontahi/core/data-graph';
import { entity, relation } from '@ontahi/core/runtime/server';

export const atlasUserFields = {
  id: field.id(),
  name: field.nonEmptyString({ trim: true }),
  email: field.nonEmptyString({ trim: true }),
  emailVerified: field.boolean(),
  image: field.nullable(field.string()),
  createdAt: field.nonEmptyString({ trim: true }),
  updatedAt: field.nonEmptyString({ trim: true }),
};

export const atlasAuthAccountFields = {
  id: field.id(),
  issuer: field.nonEmptyString({ trim: true }),
  accountId: field.nonEmptyString({ trim: true }),
  providerId: field.nonEmptyString({ trim: true }),
  userId: field.id(),
  createdAt: field.nonEmptyString({ trim: true }),
  updatedAt: field.nonEmptyString({ trim: true }),
};

export const atlasWorkspaceFields = {
  id: field.id(),
  slug: field.nonEmptyString({ trim: true }),
  name: field.nonEmptyString({ trim: true }),
  visibility: field.enum(['private', 'public']),
  createdAt: field.nonEmptyString({ trim: true }),
  updatedAt: field.nonEmptyString({ trim: true }),
};

export const atlasWorkspaceMembershipFields = {
  id: field.id(),
  workspaceId: field.id(),
  userId: field.id(),
  role: field.enum(['owner', 'editor', 'viewer']),
  status: field.enum(['active', 'suspended']),
  createdAt: field.nonEmptyString({ trim: true }),
  updatedAt: field.nonEmptyString({ trim: true }),
};

const AtlasAuthAccountRef = entity.ref('AtlasAuthAccount', { fields: atlasAuthAccountFields });
const AtlasWorkspaceMembershipRef = entity.ref('AtlasWorkspaceMembership', {
  fields: atlasWorkspaceMembershipFields,
});
const AtlasExecutionStreamRef = entity.ref('AtlasExecutionStream');

export const AtlasUser = entity({
  name: 'AtlasUser',
  fields: atlasUserFields,
  domainOperationDefaults: {
    authority: 'server',
    exposure: 'server-only',
    layer: 'atlas.identity',
  },
  relations: {
    accounts: relation.hasMany(AtlasAuthAccountRef, { via: 'userId' }),
    workspaceMemberships: relation.hasMany(AtlasWorkspaceMembershipRef, { via: 'userId' }),
    executionStreams: relation.hasMany(AtlasExecutionStreamRef, { via: 'userId' }),
  },
});

export const AtlasAuthAccount = entity({
  name: 'AtlasAuthAccount',
  fields: atlasAuthAccountFields,
  domainOperationDefaults: {
    authority: 'server',
    exposure: 'server-only',
    layer: 'atlas.identity',
  },
  relations: {
    user: relation.belongsTo(AtlasUser, { via: 'userId' }),
  },
});

export const AtlasWorkspace = entity({
  name: 'AtlasWorkspace',
  fields: atlasWorkspaceFields,
  domainOperationDefaults: {
    authority: 'server',
    exposure: 'server-only',
    layer: 'atlas.workspace',
  },
  relations: {
    memberships: relation.hasMany(AtlasWorkspaceMembershipRef, { via: 'workspaceId' }),
  },
});

export const AtlasWorkspaceMembership = entity({
  name: 'AtlasWorkspaceMembership',
  fields: atlasWorkspaceMembershipFields,
  domainOperationDefaults: {
    authority: 'server',
    exposure: 'server-only',
    layer: 'atlas.workspace',
  },
  relations: {
    workspace: relation.belongsTo(AtlasWorkspace, { via: 'workspaceId' }),
    user: relation.belongsTo(AtlasUser, { via: 'userId' }),
  },
});
