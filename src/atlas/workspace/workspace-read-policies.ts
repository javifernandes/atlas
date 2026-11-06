import { Selection, type GraphReadPolicy } from '@ontahi/core/data-graph';
import type { Principal } from '@ontahi/core/runtime/server';

import type { AtlasWorkspaceAuthority } from './workspace-access';
import {
  AtlasUser,
  AtlasWorkspace,
  AtlasWorkspaceMembership,
  AtlasWorkspaceSource,
  AtlasWorkspaceContributor,
  AtlasWorkspaceSourceImport,
} from './workspace-entities';

export type AtlasRuntimeAuthority = {
  principal: Principal | null;
  workspace: AtlasWorkspaceAuthority | null;
};

const noSelection = { kind: 'none' } as const;

const workspaceScope = ({ authority }: { authority: AtlasRuntimeAuthority }) =>
  authority.workspace
    ? Selection.where(AtlasWorkspace, workspace => workspace.id.eq(authority.workspace!.id))
    : noSelection;

const membershipScope = ({ authority }: { authority: AtlasRuntimeAuthority }) =>
  authority.workspace
    ? Selection.where(AtlasWorkspaceMembership, membership =>
        membership.workspaceId.eq(authority.workspace!.id),
      ).and(membership => membership.status.eq('active'))
    : noSelection;

const sourceScope = ({ authority }: { authority: AtlasRuntimeAuthority }) =>
  authority.workspace
    ? Selection.where(AtlasWorkspaceSource, source =>
        source.workspaceId.eq(authority.workspace!.id),
      )
    : noSelection;

const contributorScope = ({ authority }: { authority: AtlasRuntimeAuthority }) =>
  authority.workspace
    ? Selection.where(AtlasWorkspaceContributor, contributor =>
        contributor.workspaceId.eq(authority.workspace!.id),
      )
    : noSelection;

const sourceImportScope = ({ authority }: { authority: AtlasRuntimeAuthority }) =>
  authority.workspace
    ? Selection.where(AtlasWorkspaceSourceImport, sourceImport =>
        sourceImport.workspaceId.eq(authority.workspace!.id),
      )
    : noSelection;

export const atlasWorkspaceMemberReadPolicy = {
  entity: AtlasUser,
  modes: ['run'],
  cardinalities: ['many'],
  maxLimit: 100,
  fields: {
    id: { select: true },
    name: { select: true },
    email: { select: true },
    image: { select: true },
  },
  scope: ({ authority }) =>
    authority.workspace
      ? Selection.where(AtlasWorkspaceMembership, membership =>
          membership.workspaceId.eq(authority.workspace!.id),
        )
          .and(membership => membership.status.eq('active'))
          .through('user')
      : noSelection,
} satisfies GraphReadPolicy<typeof AtlasUser, AtlasRuntimeAuthority>;

export const atlasWorkspaceMembershipReadPolicy = {
  entity: AtlasWorkspaceMembership,
  selectionRelations: ['user'],
  modes: ['run'],
  cardinalities: ['many'],
  maxLimit: 100,
  fields: {
    id: { select: true },
    workspaceId: { select: true },
    userId: { select: true },
    role: { select: true },
    status: { select: true },
  },
  relations: {
    user: atlasWorkspaceMemberReadPolicy,
  },
  scope: membershipScope,
} satisfies GraphReadPolicy<typeof AtlasWorkspaceMembership, AtlasRuntimeAuthority>;

export const atlasWorkspaceReadPolicy = {
  entity: AtlasWorkspace,
  modes: ['run'],
  cardinalities: ['many'],
  maxLimit: 1,
  fields: {
    id: { select: true },
    slug: { select: true },
    name: { select: true },
    visibility: { select: true },
  },
  scope: workspaceScope,
} satisfies GraphReadPolicy<typeof AtlasWorkspace, AtlasRuntimeAuthority>;

export const atlasWorkspaceSourceReadPolicy = {
  entity: AtlasWorkspaceSource,
  modes: ['run'],
  cardinalities: ['many'],
  maxLimit: 100,
  fields: {
    id: { select: true },
    workspaceId: { select: true },
    sourceId: { select: true },
    provider: { select: true },
    repository: { select: true },
    ref: { select: true },
    status: { select: true },
    contributorAccess: { select: true },
  },
  scope: sourceScope,
} satisfies GraphReadPolicy<typeof AtlasWorkspaceSource, AtlasRuntimeAuthority>;

export const atlasWorkspaceContributorReadPolicy = {
  entity: AtlasWorkspaceContributor,
  modes: ['run'],
  cardinalities: ['many'],
  maxLimit: 200,
  fields: {
    id: { select: true },
    workspaceId: { select: true },
    workspaceSourceId: { select: true },
    sourceId: { select: true },
    provider: { select: true },
    providerAccountId: { select: true },
    login: { select: true },
    avatarUrl: { select: true },
    kind: { select: true },
    contributionCount: { select: true },
    lastContributedAt: { select: true },
    linkedUserId: { select: true },
  },
  scope: contributorScope,
} satisfies GraphReadPolicy<typeof AtlasWorkspaceContributor, AtlasRuntimeAuthority>;

export const atlasWorkspaceSourceImportReadPolicy = {
  entity: AtlasWorkspaceSourceImport,
  modes: ['run'],
  cardinalities: ['many'],
  maxLimit: 50,
  fields: {
    id: { select: true },
    workspaceId: { select: true },
    triggerSourceId: { select: true },
    trigger: { select: true },
    repository: { select: true },
    observedRevision: { select: true },
    status: { select: true },
    startedAt: { select: true, order: true },
    completedAt: { select: true },
    error: { select: true },
    diagnosticsJson: { select: true },
  },
  scope: sourceImportScope,
} satisfies GraphReadPolicy<typeof AtlasWorkspaceSourceImport, AtlasRuntimeAuthority>;

export const atlasWorkspaceReadPolicies = [
  atlasWorkspaceReadPolicy,
  atlasWorkspaceMembershipReadPolicy,
  atlasWorkspaceMemberReadPolicy,
  atlasWorkspaceSourceReadPolicy,
  atlasWorkspaceContributorReadPolicy,
  atlasWorkspaceSourceImportReadPolicy,
] as const;
