'use client';

import { X } from 'lucide-react';
import { useEffect, useId } from 'react';
import { createPortal } from 'react-dom';

export const Modal = ({
  children,
  description,
  onClose,
  open,
  title,
}: {
  children: React.ReactNode;
  description?: string;
  onClose: () => void;
  open: boolean;
  title: string;
}) => {
  const titleId = useId();
  const descriptionId = useId();
  useEffect(() => {
    if (!open) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', escape);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', escape);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose, open]);

  if (!open || typeof document === 'undefined') return null;
  return createPortal(
    <div
      aria-describedby={description ? descriptionId : undefined}
      aria-labelledby={titleId}
      aria-modal='true'
      className='fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm'
      onMouseDown={event => {
        if (event.currentTarget === event.target) onClose();
      }}
      role='dialog'
    >
      <section className='grid max-h-[min(42rem,calc(100vh-2rem))] w-full max-w-lg gap-6 overflow-y-auto rounded-xl border border-border bg-background p-6 shadow-2xl shadow-black/50'>
        <header className='flex items-start justify-between gap-4'>
          <div className='grid gap-1'>
            <h2 className='text-xl font-semibold' id={titleId}>{title}</h2>
            {description ? <p className='text-sm leading-6 text-muted-foreground' id={descriptionId}>{description}</p> : null}
          </div>
          <button
            aria-label='Close dialog'
            className='rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground'
            onClick={onClose}
            type='button'
          >
            <X className='size-5' />
          </button>
        </header>
        {children}
      </section>
    </div>,
    document.body,
  );
};
