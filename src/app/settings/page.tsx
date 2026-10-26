import { headers } from 'next/headers';
import Link from 'next/link';

import { getAtlasWorkspaceForUser } from '@/atlas/workspace/workspace-access';
import { getAtlasRequestAccess } from '@/auth/server';
import { AuthLanding } from '@/components/auth/auth-landing';
import { WorkspaceAccessDenied } from '@/components/workspace/workspace-access-denied';

export const dynamic = 'force-dynamic';

const WorkspaceSettingsPage = async () => {
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

  const workspace = await getAtlasWorkspaceForUser(access.viewer.id);

  if (!workspace) {
    return <WorkspaceAccessDenied viewer={access.viewer} />;
  }

  return (
    <main className='min-h-screen bg-background px-6 py-12 text-foreground'>
      <div className='mx-auto grid w-full max-w-3xl gap-8'>
        <header className='grid gap-2'>
          <Link className='text-sm text-muted-foreground hover:text-foreground' href='/'>
            ← Back to Atlas
          </Link>
          <p className='font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground'>
            Workspace settings
          </p>
          <h1 className='text-3xl font-semibold'>{workspace.name}</h1>
          <p className='text-sm text-muted-foreground'>
            /{workspace.slug} · {workspace.visibility} · your role: {workspace.role}
          </p>
        </header>

        <section className='grid gap-3'>
          <div>
            <h2 className='text-lg font-medium'>Members</h2>
            <p className='text-sm text-muted-foreground'>
              Invitations and role management arrive in the next sharing slice.
            </p>
          </div>
          <div className='overflow-hidden rounded-lg border border-border'>
            {workspace.members.map(member => (
              <div
                className='flex items-center justify-between gap-4 border-b border-border/70 px-4 py-3 last:border-b-0'
                key={member.userId}
              >
                <div className='min-w-0'>
                  <p className='truncate text-sm font-medium'>{member.name}</p>
                  <p className='truncate text-xs text-muted-foreground'>{member.email}</p>
                </div>
                <span className='font-mono text-xs uppercase text-muted-foreground'>
                  {member.role}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
};

export default WorkspaceSettingsPage;
