'use client';

import { Github, LogOut, Moon, Sun } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import type { AtlasViewer } from '@/auth/access';
import { atlasAuthClient } from '@/auth/client';
import { useTheme } from '@/components/theme-provider';
import { cn } from '@/lib/classes';

type AuthControlProps = {
  authAvailable: boolean;
  callbackURL?: string;
  className?: string;
  errorCallbackURL?: string;
  viewer: AtlasViewer | null;
  variant?: 'chrome' | 'compact' | 'sign-in';
};

const ThemeMenuItem = ({ onSelect }: { onSelect: () => void }) => {
  const { theme, toggleTheme } = useTheme();
  const nextTheme = theme === 'light' ? 'dark' : 'light';

  return (
    <button
      type='button'
      role='menuitem'
      className='flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground'
      onClick={() => {
        toggleTheme();
        onSelect();
      }}
    >
      {nextTheme === 'dark' ? <Moon className='size-4' /> : <Sun className='size-4' />}
      Switch to {nextTheme} mode
    </button>
  );
};

export const AuthControl = ({
  authAvailable,
  callbackURL = '/',
  className,
  errorCallbackURL = '/sign-in',
  viewer,
  variant = 'compact',
}: AuthControlProps) => {
  const [pendingAction, setPendingAction] = useState<'sign-in' | 'sign-out' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', escape);
    };
  }, [menuOpen]);

  if (!authAvailable) {
    return null;
  }

  const signIn = async () => {
    setError(null);
    setPendingAction('sign-in');

    const result = await atlasAuthClient.signIn.social({
      callbackURL,
      errorCallbackURL,
      provider: 'github',
    });

    if (result.error) {
      setError(result.error.message ?? 'GitHub sign-in failed.');
      setPendingAction(null);
    }
  };

  const signOut = async () => {
    setError(null);
    setPendingAction('sign-out');
    const result = await atlasAuthClient.signOut();

    if (result.error) {
      setError(result.error.message ?? 'Sign-out failed.');
      setPendingAction(null);
      return;
    }

    globalThis.location.assign('/');
  };

  if (!viewer) {
    return (
      <div className={cn('flex flex-col items-stretch gap-2', className)}>
        <button
          type='button'
          className={cn(
            'inline-flex items-center justify-center gap-2 rounded-lg border border-border/75 bg-background/85 px-3 py-2 text-sm font-medium shadow-lg backdrop-blur-xl transition-colors hover:border-primary/45 hover:bg-background disabled:cursor-wait disabled:opacity-60',
            variant === 'sign-in' && 'h-11 w-full shadow-sm',
          )}
          disabled={pendingAction !== null}
          onClick={signIn}
        >
          <Github className='size-4' />
          {pendingAction === 'sign-in'
            ? 'Connecting…'
            : variant === 'sign-in'
              ? 'Continue with GitHub'
              : 'Sign in'}
        </button>
        {error ? <p className='m-0 text-xs text-destructive'>{error}</p> : null}
      </div>
    );
  }

  const avatar = viewer.image ? (
    // The avatar URL comes from the validated GitHub profile held by Better Auth.
    // eslint-disable-next-line @next/next/no-img-element
    <img className='size-7 rounded-full' src={viewer.image} alt='' />
  ) : (
    <span className='grid size-7 place-items-center rounded-full bg-primary/15 text-xs font-semibold text-primary'>
      {viewer.name.slice(0, 1).toUpperCase()}
    </span>
  );

  if (variant === 'chrome') {
    return (
      <div
        className={cn(
          'top-3 flex items-center',
          className,
        )}
        ref={menuRef}
      >
        <button
          type='button'
          aria-expanded={menuOpen}
          aria-haspopup='menu'
          aria-label='Open account menu'
          className='grid size-9 place-items-center rounded-full transition-colors hover:bg-muted/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30'
          onClick={() => setMenuOpen(current => !current)}
        >
          {avatar}
        </button>
        {menuOpen ? (
          <div
            role='menu'
            className='absolute right-0 top-full z-30 mt-2 w-56 rounded-lg border border-border/75 bg-background p-1.5 shadow-2xl'
          >
            <div className='px-2.5 py-2'>
              <p className='truncate text-sm font-medium'>{viewer.name}</p>
              <p className='truncate text-xs text-muted-foreground'>{viewer.email}</p>
            </div>
            <ThemeMenuItem onSelect={() => setMenuOpen(false)} />
            <button
              type='button'
              role='menuitem'
              className='flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-wait disabled:opacity-60'
              disabled={pendingAction !== null}
              onClick={() => {
                setMenuOpen(false);
                void signOut();
              }}
            >
              <LogOut className='size-4' />
              Sign out
            </button>
            {error ? <span className='sr-only'>{error}</span> : null}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex items-center gap-1 rounded-lg border border-border/75 bg-background/85 p-1.5 shadow-lg backdrop-blur-xl',
        className,
      )}
    >
      {avatar}
      <span className='max-w-32 truncate px-1 text-xs font-medium max-sm:hidden'>
        {viewer.name}
      </span>
      <button
        type='button'
        aria-label='Sign out'
        title='Sign out'
        className='grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground disabled:cursor-wait disabled:opacity-60'
        disabled={pendingAction !== null}
        onClick={signOut}
      >
        <LogOut className='size-4' />
      </button>
      {error ? <span className='sr-only'>{error}</span> : null}
    </div>
  );
};
