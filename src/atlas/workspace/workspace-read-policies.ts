import { Selection, type GraphReadPolicy } from '@ontahi/core/data-graph';
import type { Principal } from '@ontahi/core/runtime/server';

import type { AtlasWorkspaceAuthority } from './workspace-access';
import {
  AtlasUser,
  AtlasWorkspace,
  AtlasWorkspaceMembership,
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

export const atlasWorkspaceReadPolicies = [
  atlasWorkspaceReadPolicy,
  atlasWorkspaceMembershipReadPolicy,
  atlasWorkspaceMemberReadPolicy,
] as const;
