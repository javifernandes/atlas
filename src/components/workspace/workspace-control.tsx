'use client';

import Link from 'next/link';
import { LayoutGrid, Settings2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

import type { AtlasWorkspaceAccess } from '@/atlas/workspace/workspace-access';
import { Select } from '@/components/ui/select';

export const WorkspaceControl = ({
  workspace,
  workspaces = [workspace],
}: {
  workspace: AtlasWorkspaceAccess;
  workspaces?: AtlasWorkspaceAccess[];
}) => {
  const router = useRouter();
  return (
    <div className='fixed left-4 top-4 z-50 inline-flex items-center overflow-hidden rounded-md border border-border/70 bg-card/90 text-xs shadow-sm backdrop-blur'>
      <Link
        aria-label='All Workspaces'
        className='grid h-8 w-8 place-items-center border-r border-border/70 text-muted-foreground transition-colors hover:text-foreground'
        href='/'
      >
        <LayoutGrid className='size-3.5' />
      </Link>
      <div className='w-44'>
      <Select
        compact
        label='Current Workspace'
        onChange={value =>
          router.push(
            value === '__new__'
              ? '/workspaces/new'
              : `/w/${encodeURIComponent(value)}`,
          )
        }
        options={[
          ...workspaces.map(candidate => ({ label: candidate.name, value: candidate.slug })),
          { label: '＋ New Workspace', value: '__new__' },
        ]}
        value={workspace.slug}
      />
      </div>
      <Link
        aria-label={`Workspace settings for ${workspace.name}`}
        className='grid h-8 w-8 place-items-center border-l border-border/70 text-muted-foreground transition-colors hover:text-foreground'
        href={`/w/${encodeURIComponent(workspace.slug)}/settings`}
      >
        <Settings2 className='size-3.5' />
      </Link>
    </div>
  );
};
