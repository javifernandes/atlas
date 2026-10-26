import Link from 'next/link';
import { Settings2 } from 'lucide-react';

import type { AtlasWorkspaceAccess } from '@/atlas/workspace/workspace-access';

export const WorkspaceControl = ({ workspace }: { workspace: AtlasWorkspaceAccess }) => (
  <Link
    aria-label={`Workspace settings for ${workspace.name}`}
    className='fixed left-4 top-4 z-50 inline-flex items-center gap-2 rounded-md border border-border/70 bg-card/90 px-2.5 py-1.5 text-xs text-muted-foreground shadow-sm backdrop-blur transition-colors hover:text-foreground'
    href='/settings'
  >
    <span className='font-medium text-foreground'>{workspace.name}</span>
    <span className='font-mono text-[10px] uppercase'>{workspace.role}</span>
    <Settings2 className='size-3.5' />
  </Link>
);
