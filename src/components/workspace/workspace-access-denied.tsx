import Link from 'next/link';

import type { AtlasViewer } from '@/auth/access';

export const WorkspaceAccessDenied = ({ viewer }: { viewer: AtlasViewer }) => (
  <main className='grid min-h-screen place-items-center bg-background px-6 text-foreground'>
    <section className='grid max-w-md gap-4 text-center'>
      <p className='font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground'>
        Workspace access
      </p>
      <h1 className='text-2xl font-semibold'>No active membership</h1>
      <p className='text-sm leading-6 text-muted-foreground'>
        {viewer.name}, your Atlas identity is valid, but it is not a member of this Workspace.
        Ask a Workspace owner to invite you.
      </p>
      <Link className='text-sm text-primary hover:underline' href='/'>
        Return to Atlas
      </Link>
    </section>
  </main>
);
