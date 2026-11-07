'use client';

import { Check, ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export type SelectOption<T extends string> = {
  description?: string;
  label: string;
  value: T;
};

export const Select = <T extends string>({
  disabled = false,
  compact = false,
  label,
  onChange,
  options,
  value,
}: {
  disabled?: boolean;
  compact?: boolean;
  label: string;
  onChange: (value: T) => void;
  options: SelectOption<T>[];
  value: T;
}) => {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const selected = options.find(option => option.value === value) ?? options[0];

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
    <div className={`relative grid ${compact ? '' : 'gap-2'}`} ref={root}>
      <span className={compact ? 'sr-only' : 'text-sm font-medium'}>{label}</span>
      <button
        aria-label={label}
        aria-expanded={open}
        aria-haspopup='listbox'
        className={`flex w-full items-center justify-between gap-3 text-left outline-none transition-colors focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60 ${compact ? 'h-8 bg-transparent px-2 text-xs font-medium' : 'min-h-11 rounded-lg border border-border bg-background px-3 text-sm hover:border-foreground/40 focus:border-primary'}`}
        disabled={disabled}
        onClick={() => setOpen(current => !current)}
        type='button'
      >
        <span className='grid gap-0.5'>
          <span>{selected?.label}</span>
          {selected?.description ? (
            <span className='text-xs text-muted-foreground'>{selected.description}</span>
          ) : null}
        </span>
        <ChevronDown className={`size-4 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open ? (
        <div
          aria-label={label}
          className='absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-lg border border-border bg-background p-1 shadow-2xl shadow-black/30'
          role='listbox'
        >
          {options.map(option => {
            const active = option.value === value;
            return (
              <button
                aria-selected={active}
                className='flex w-full items-center justify-between gap-3 rounded-md px-3 py-2.5 text-left hover:bg-muted focus:bg-muted focus:outline-none'
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                role='option'
                type='button'
              >
                <span className='grid gap-0.5'>
                  <span className='text-sm font-medium'>{option.label}</span>
                  {option.description ? (
                    <span className='text-xs text-muted-foreground'>{option.description}</span>
                  ) : null}
                </span>
                <Check className={`size-4 text-primary ${active ? 'opacity-100' : 'opacity-0'}`} />
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
};
