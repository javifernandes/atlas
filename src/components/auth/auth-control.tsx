'use client';

import { Github, LogOut } from 'lucide-react';
import { useState } from 'react';

import type { AtlasViewer } from '@/auth/access';
import { atlasAuthClient } from '@/auth/client';
import { cn } from '@/lib/classes';

type AuthControlProps = {
  authAvailable: boolean;
  className?: string;
  viewer: AtlasViewer | null;
  variant?: 'compact' | 'sign-in';
};

export const AuthControl = ({
  authAvailable,
  className,
  viewer,
  variant = 'compact',
}: AuthControlProps) => {
  const [pendingAction, setPendingAction] = useState<'sign-in' | 'sign-out' | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!authAvailable) {
    return null;
  }

  const signIn = async () => {
    setError(null);
    setPendingAction('sign-in');

    const result = await atlasAuthClient.signIn.social({
      callbackURL: '/',
      errorCallbackURL: '/sign-in',
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
          {pendingAction === 'sign-in' ? 'Connecting…' : 'Sign in'}
        </button>
        {error ? <p className='m-0 text-xs text-destructive'>{error}</p> : null}
      </div>
    );
  }

  return (
    <div className={cn('flex items-center gap-1 rounded-lg border border-border/75 bg-background/85 p-1.5 shadow-lg backdrop-blur-xl', className)}>
      {viewer.image ? (
        // The avatar URL comes from the validated GitHub profile held by Better Auth.
        // eslint-disable-next-line @next/next/no-img-element
        <img className='size-7 rounded-full' src={viewer.image} alt='' />
      ) : (
        <span className='grid size-7 place-items-center rounded-full bg-primary/15 text-xs font-semibold text-primary'>
          {viewer.name.slice(0, 1).toUpperCase()}
        </span>
      )}
      <span className='max-w-32 truncate px-1 text-xs font-medium'>{viewer.name}</span>
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
