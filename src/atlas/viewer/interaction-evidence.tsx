'use client';

import { ExternalLink } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import {
  getStorybookDeepLink,
  getStorybookEvidenceForItem,
  getStorybookPreviewUrl,
} from '@/atlas/evidence/storybook-evidence';
import { cn } from '@/lib/classes';

export const InteractionEvidence = ({ itemId }: { itemId: string }) => {
  const evidence = useMemo(() => getStorybookEvidenceForItem(itemId), [itemId]);
  const [selectedId, setSelectedId] = useState(evidence[0]?.id ?? '');
  const selected = evidence.find(item => item.id === selectedId) ?? evidence[0];
  const deepLink = selected ? getStorybookDeepLink(selected) : null;
  const previewUrl = selected ? getStorybookPreviewUrl(selected) : null;

  useEffect(() => {
    setSelectedId(evidence[0]?.id ?? '');
  }, [evidence]);

  if (!selected) {
    return (
      <div className='flex h-full items-center justify-center text-sm text-muted-foreground'>
        No inspectable UI evidence is registered yet.
      </div>
    );
  }

  return (
    <div className='grid h-full min-h-0 grid-cols-[minmax(13rem,18rem)_minmax(0,1fr)]'>
      <nav
        aria-label='Storybook evidence'
        className='min-h-0 overflow-y-auto border-r border-border/45 px-3 py-16'
      >
        <p className='px-3 pb-3 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground'>
          Inspectable states
        </p>
        <div className='space-y-1'>
          {evidence.map(item => (
            <button
              className={cn(
                'w-full rounded-lg px-3 py-2.5 text-left transition-colors',
                selected.id === item.id
                  ? 'bg-primary/10 text-foreground'
                  : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground',
              )}
              key={item.id}
              onClick={() => setSelectedId(item.id)}
              type='button'
            >
              <span className='block text-sm font-medium'>{item.title}</span>
              <span className='mt-1 block font-mono text-[9px] uppercase tracking-[0.1em] text-primary/80'>
                {item.activity}
              </span>
            </button>
          ))}
        </div>
      </nav>
      <div className='flex min-h-0 min-w-0 flex-col px-5 pb-5 pt-14'>
        <header className='flex items-start justify-between gap-5 pb-4'>
          <div>
            <h3 className='text-lg font-semibold'>{selected.title}</h3>
            <p className='mt-1 text-sm text-muted-foreground'>{selected.description}</p>
          </div>
          {deepLink ? (
            <a
              className='inline-flex shrink-0 items-center gap-2 rounded-lg border border-border/60 px-3 py-2 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary'
              href={deepLink}
              rel='noreferrer'
              target='_blank'
            >
              Open in Storybook <ExternalLink className='size-3.5' />
            </a>
          ) : null}
        </header>
        {previewUrl ? (
          <div className='min-h-0 flex-1 overflow-hidden rounded-xl border border-border/55 bg-background'>
            <iframe
              className='h-full min-h-[30rem] w-full'
              key={selected.storyId}
              src={previewUrl}
              title={`${selected.title} Storybook preview`}
            />
          </div>
        ) : (
          <div className='flex min-h-0 flex-1 items-center justify-center rounded-xl border border-dashed border-border/55 bg-muted/10 px-8 text-center'>
            <div className='max-w-md'>
              <p className='text-sm font-medium'>Storybook preview is not configured.</p>
              <p className='mt-2 text-sm text-muted-foreground'>
                This semantic binding remains available without making Storybook a runtime
                dependency. Configure NEXT_PUBLIC_ATLAS_STORYBOOK_URL to inspect its UI realization.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
