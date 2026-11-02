import type { AtlasWorkspaceAccess } from '@/atlas/workspace/workspace-access';

import { WorkspaceControl } from './workspace-control';

export const WorkspaceEmptyState = ({
  workspace,
  workspaces,
}: {
  workspace: AtlasWorkspaceAccess;
  workspaces: AtlasWorkspaceAccess[];
}) => (
  <main className='grid min-h-screen place-items-center bg-background px-6 text-foreground'>
    <WorkspaceControl workspace={workspace} workspaces={workspaces} />
    <section className='grid max-w-md gap-3 text-center'>
      <p className='font-mono text-xs uppercase tracking-[0.18em] text-primary'>Empty Workspace</p>
      <h1 className='text-3xl font-semibold'>{workspace.name}</h1>
      <p className='text-sm leading-6 text-muted-foreground'>
        This Workspace is ready. Repository connection is the next onboarding step.
      </p>
    </section>
  </main>
);
