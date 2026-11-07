import { headers } from 'next/headers';

import { getAtlasWorkspaceForUser } from '@/atlas/workspace/workspace-access';
import { getAtlasRequestAccess } from '@/auth/server';
import { AuthLanding } from '@/components/auth/auth-landing';
import { WorkspaceAccessDenied } from '@/components/workspace/workspace-access-denied';
import {
  WorkspaceSettings,
  type WorkspaceSettingsSection,
} from '@/components/workspace/workspace-settings';

export const dynamic = 'force-dynamic';

const workspaceSettingsSections = new Set<WorkspaceSettingsSection>([
  'general',
  'history',
  'people',
  'sources',
]);

const WorkspaceSettingsPage = async ({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams?: { section?: string | string[] };
}) => {
  const access = await getAtlasRequestAccess(headers());
  if (!access.canRead || !access.viewer) {
    return (
      <AuthLanding
        authAvailable={access.authAvailable}
        configurationError={access.configurationError}
        viewer={access.viewer}
      />
    );
  }

  const workspace = await getAtlasWorkspaceForUser(access.viewer.id, params.slug);
  if (!workspace) return <WorkspaceAccessDenied viewer={access.viewer} />;
  const requestedSection = Array.isArray(searchParams?.section)
    ? searchParams.section[0]
    : searchParams?.section;
  const activeSection = workspaceSettingsSections.has(
    requestedSection as WorkspaceSettingsSection,
  )
    ? requestedSection as WorkspaceSettingsSection
    : 'general';
  return (
    <WorkspaceSettings
      activeSection={activeSection}
      viewer={access.viewer}
      workspaceRole={workspace.role}
    />
  );
};

export default WorkspaceSettingsPage;
