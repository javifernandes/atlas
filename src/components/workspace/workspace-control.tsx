'use client';

import Link from 'next/link';
import { LayoutGrid, Settings2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import type { AtlasWorkspaceAccess } from '@/atlas/workspace/workspace-access';
import {
  atlasRecentNodesChangedEvent,
  atlasRecentNodesStorageKey,
  readRecentAtlasNodes,
  type RecentAtlasNode,
} from '@/atlas/viewer/recent-nodes';

export const WorkspaceControl = ({
  workspace,
}: {
  workspace: AtlasWorkspaceAccess;
  workspaces?: AtlasWorkspaceAccess[];
}) => {
  const [open, setOpen] = useState(false);
  const [recentNodes, setRecentNodes] = useState<RecentAtlasNode[]>([]);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const refresh = () => {
      setRecentNodes(
        readRecentAtlasNodes()
          .filter(node => node.workspaceSlug === workspace.slug)
          .slice(0, 5),
      );
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key === atlasRecentNodesStorageKey) refresh();
    };

    refresh();
    globalThis.addEventListener(atlasRecentNodesChangedEvent, refresh);
    globalThis.addEventListener('storage', handleStorage);
    return () => {
      globalThis.removeEventListener(atlasRecentNodesChangedEvent, refresh);
      globalThis.removeEventListener('storage', handleStorage);
    };
  }, [workspace.slug]);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  return (
    <div className='fixed left-4 top-3 z-[140] text-xs' ref={root}>
      <button
        type='button'
        aria-expanded={open}
        aria-haspopup='menu'
        aria-label='Open Workspace menu'
        className='grid size-9 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted/55 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30'
        onClick={() => setOpen(current => !current)}
      >
        <LayoutGrid className='size-3.5' />
      </button>
      {open ? (
        <div
          role='menu'
          className='absolute left-0 top-full z-30 mt-2 w-64 rounded-lg border border-border/75 bg-background p-1.5 shadow-2xl'
        >
          <div className='px-2.5 py-2'>
            <p className='font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground'>
              Workspace
            </p>
            <p className='mt-0.5 truncate text-sm font-medium'>{workspace.name}</p>
          </div>
          <Link
            role='menuitem'
            className='flex items-center gap-2 rounded-md px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground'
            href='/'
            onClick={() => setOpen(false)}
          >
            <LayoutGrid className='size-4' />
            All Workspaces
          </Link>
          <Link
            role='menuitem'
            className='flex items-center gap-2 rounded-md px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground'
            href={`/w/${encodeURIComponent(workspace.slug)}/settings`}
            onClick={() => setOpen(false)}
          >
            <Settings2 className='size-4' />
            Workspace settings
          </Link>
          {recentNodes.length > 0 ? (
            <div className='mt-1 border-t border-border/55 pt-1'>
              <p className='px-2.5 pb-1 pt-1.5 font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground'>
                Recent
              </p>
              {recentNodes.map(node => (
                <Link
                  role='menuitem'
                  key={node.id}
                  className='block rounded-md px-2.5 py-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground'
                  href={node.href}
                  onClick={() => setOpen(false)}
                >
                  <span className='block truncate text-sm'>{node.title}</span>
                  <span className='mt-0.5 block font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground/75'>
                    {node.kind}
                  </span>
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};
