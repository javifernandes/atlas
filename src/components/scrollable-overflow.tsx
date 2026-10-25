'use client';

import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from 'lucide-react';
import {
  type HTMLAttributes,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import { cn } from '@/lib/classes';

type ScrollAxis = 'horizontal' | 'vertical';

type ScrollableOverflowProps = {
  axis: ScrollAxis;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  viewportClassName?: string;
  viewportProps?: HTMLAttributes<HTMLDivElement>;
};

type HiddenCounts = { end: number; start: number };

const noHiddenItems: HiddenCounts = { end: 0, start: 0 };

const OverflowHint = ({
  axis,
  count,
  side,
}: {
  axis: ScrollAxis;
  count: number;
  side: 'end' | 'start';
}) => {
  if (count === 0) return null;

  const Icon =
    axis === 'vertical'
      ? side === 'start'
        ? ChevronUp
        : ChevronDown
      : side === 'start'
        ? ChevronLeft
        : ChevronRight;
  const direction =
    axis === 'vertical'
      ? side === 'start'
        ? 'above'
        : 'below'
      : side === 'start'
        ? 'to the left'
        : 'to the right';

  return (
    <div
      aria-label={`${count} more ${direction}`}
      className={cn(
        'pointer-events-none absolute z-20 flex',
        axis === 'vertical' && side === 'start' &&
          'inset-x-0 top-0 h-14 items-start justify-center bg-gradient-to-b from-card via-card/85 to-transparent pt-1.5',
        axis === 'vertical' && side === 'end' &&
          'inset-x-0 bottom-0 h-14 items-end justify-center bg-gradient-to-t from-card via-card/85 to-transparent pb-1.5',
        axis === 'horizontal' && side === 'start' &&
          'inset-y-0 left-0 w-24 items-center justify-start bg-gradient-to-r from-card via-card/85 to-transparent pl-1.5',
        axis === 'horizontal' && side === 'end' &&
          'inset-y-0 right-0 w-24 items-center justify-end bg-gradient-to-l from-card via-card/85 to-transparent pr-1.5',
      )}
    >
      <span className='inline-flex items-center gap-1 rounded-full border border-border/55 bg-background/72 px-2 py-1 font-mono text-[9px] text-muted-foreground shadow-sm backdrop-blur-md'>
        <Icon aria-hidden='true' className='size-3' />
        {count} more
      </span>
    </div>
  );
};

export const ScrollableOverflow = ({
  axis,
  children,
  className,
  contentClassName,
  viewportClassName,
  viewportProps,
}: ScrollableOverflowProps) => {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [hidden, setHidden] = useState<HiddenCounts>(noHiddenItems);

  const measure = useCallback(() => {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content) return;

    const viewportRect = viewport.getBoundingClientRect();
    const items = [...content.children] as HTMLElement[];
    let start = 0;
    let end = 0;

    for (const item of items) {
      const rect = item.getBoundingClientRect();
      if (axis === 'vertical') {
        if (rect.top < viewportRect.top - 1) start += 1;
        if (rect.bottom > viewportRect.bottom + 1) end += 1;
      } else {
        if (rect.left < viewportRect.left - 1) start += 1;
        if (rect.right > viewportRect.right + 1) end += 1;
      }
    }

    setHidden(current =>
      current.start === start && current.end === end ? current : { end, start },
    );
  }, [axis]);

  useEffect(() => {
    measure();
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content) return;

    const resizeObserver =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    resizeObserver?.observe(viewport);
    resizeObserver?.observe(content);
    viewport.addEventListener('scroll', measure, { passive: true });
    globalThis.addEventListener('resize', measure);

    return () => {
      resizeObserver?.disconnect();
      viewport.removeEventListener('scroll', measure);
      globalThis.removeEventListener('resize', measure);
    };
  }, [children, measure]);

  return (
    <div className={cn('relative min-h-0 min-w-0', className)}>
      <div {...viewportProps} ref={viewportRef} className={viewportClassName}>
        <div ref={contentRef} className={contentClassName}>
          {children}
        </div>
      </div>
      <OverflowHint axis={axis} count={hidden.start} side='start' />
      <OverflowHint axis={axis} count={hidden.end} side='end' />
    </div>
  );
};
