import { Selection, type GraphReadPolicy } from '@ontahi/core';
import type { Principal } from '@ontahi/core/runtime/server';

import type { AtlasWorkspaceAuthority } from './workspace-access';
import {
  AtlasUser,
  AtlasWorkspace,
  AtlasWorkspaceMembership,
  AtlasWorkspaceInvitation,
  AtlasWorkspaceSource,
  AtlasWorkspaceContributor,
  AtlasWorkspaceProjectionRevision,
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

const invitationScope = ({ authority }: { authority: AtlasRuntimeAuthority }) =>
  authority.workspace?.role === 'owner'
    ? Selection.where(AtlasWorkspaceInvitation, invitation =>
        invitation.workspaceId.eq(authority.workspace!.id),
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

const projectionRevisionScope = ({ authority }: { authority: AtlasRuntimeAuthority }) =>
  authority.workspace
    ? Selection.where(AtlasWorkspaceProjectionRevision, revision =>
        revision.workspaceId.eq(authority.workspace!.id),
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

const atlasWorkspaceMembershipUserReadPolicy = {
  entity: AtlasUser,
  modes: ['run'],
  cardinalities: ['many'],
  maxLimit: 100,
  fields: atlasWorkspaceMemberReadPolicy.fields,
  // The parent Membership is already restricted to the active Workspace. Reapplying the
  // root User policy here would traverse Membership again while materializing this relation.
  scope: 'all',
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
    user: atlasWorkspaceMembershipUserReadPolicy,
  },
  scope: membershipScope,
} satisfies GraphReadPolicy<typeof AtlasWorkspaceMembership, AtlasRuntimeAuthority>;

export const atlasWorkspaceInvitationReadPolicy = {
  entity: AtlasWorkspaceInvitation,
  modes: ['run'],
  cardinalities: ['many'],
  maxLimit: 100,
  fields: {
    id: { select: true },
    workspaceId: { select: true },
    recipientKind: { select: true },
    recipientUserId: { select: true },
    recipientProvider: { select: true },
    recipientProviderAccountId: { select: true },
    proposedRole: { select: true },
    status: { select: true },
    expiresAt: { select: true },
    createdAt: { select: true },
  },
  scope: invitationScope,
} satisfies GraphReadPolicy<typeof AtlasWorkspaceInvitation, AtlasRuntimeAuthority>;

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
    providerDeliveryId: { select: true },
    triggerRevision: { select: true },
    pullRequestNumber: { select: true },
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

export const atlasWorkspaceProjectionRevisionReadPolicy = {
  entity: AtlasWorkspaceProjectionRevision,
  modes: ['run'],
  cardinalities: ['many'],
  maxLimit: 1,
  fields: {
    id: { select: true },
    workspaceId: { select: true },
    createdAt: { select: true, order: true },
  },
  scope: projectionRevisionScope,
} satisfies GraphReadPolicy<typeof AtlasWorkspaceProjectionRevision, AtlasRuntimeAuthority>;

export const atlasWorkspaceReadPolicies = [
  atlasWorkspaceReadPolicy,
  atlasWorkspaceMembershipReadPolicy,
  atlasWorkspaceInvitationReadPolicy,
  atlasWorkspaceMemberReadPolicy,
  atlasWorkspaceSourceReadPolicy,
  atlasWorkspaceContributorReadPolicy,
  atlasWorkspaceSourceImportReadPolicy,
  atlasWorkspaceProjectionRevisionReadPolicy,
] as const;
