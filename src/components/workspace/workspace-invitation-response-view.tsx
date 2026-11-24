import { ArrowLeft, ArrowRight, Check, LoaderCircle, LogOut, X } from 'lucide-react';
import Link from 'next/link';

import type { AtlasViewer } from '@/auth/access';

export type WorkspaceInvitation = {
  claimedByCurrentUser: boolean;
  expiresAt: string;
  id: string;
  invitedByName: string;
  proposedRole: 'collaborator' | 'viewer';
  status: 'pending' | 'claimed' | 'accepted' | 'declined' | 'revoked' | 'expired';
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
};

type WorkspaceInvitationResponseViewProps = {
  busy?: boolean;
  claiming?: boolean;
  error?: string | null;
  identityMismatch?: boolean;
  invitation?: WorkspaceInvitation | null;
  loading?: boolean;
  onAccept?: () => void;
  onClaim?: () => void;
  onDecline?: () => void;
  onUseAnotherAccount?: () => void;
  switchingAccount?: boolean;
  viewer: AtlasViewer;
};

const AtlasIdentity = ({ viewer }: { viewer: AtlasViewer }) => (
  <div className='mx-auto mt-8 flex w-full max-w-sm items-center gap-3 rounded-2xl border border-border bg-muted/25 p-4 text-left'>
    {viewer.image ? (
      // The avatar URL comes from the validated profile held by Atlas authentication.
      // eslint-disable-next-line @next/next/no-img-element
      <img alt='' className='size-11 rounded-full' src={viewer.image} />
    ) : (
      <span className='grid size-11 shrink-0 place-items-center rounded-full bg-primary/15 text-sm font-semibold text-primary'>
        {viewer.name.slice(0, 1).toUpperCase()}
      </span>
    )}
    <div className='min-w-0'>
      <p className='m-0 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground'>
        Your Atlas account
      </p>
      <p className='mb-0 mt-1 truncate font-medium text-foreground'>{viewer.name}</p>
      <p className='m-0 truncate text-sm text-muted-foreground'>{viewer.email}</p>
    </div>
  </div>
);

export const WorkspaceInvitationResponseView = ({
  busy = false,
  claiming = false,
  error = null,
  identityMismatch = false,
  invitation = null,
  loading = false,
  onAccept,
  onClaim,
  onDecline,
  onUseAnotherAccount,
  switchingAccount = false,
  viewer,
}: WorkspaceInvitationResponseViewProps) => {
  const terminal =
    invitation && ['accepted', 'declined', 'revoked', 'expired'].includes(invitation.status);

  return (
    <main className='grid min-h-screen place-items-center bg-background px-5 py-12 text-foreground'>
      <section className='w-full max-w-xl rounded-3xl border border-border bg-card p-8 shadow-2xl sm:p-10'>
        <p className='m-0 text-xs font-semibold uppercase tracking-[0.24em] text-primary'>
          Workspace invitation
        </p>

        {loading && !invitation && !error && !identityMismatch ? (
          <div className='mt-8 flex items-center gap-3 text-muted-foreground'>
            <LoaderCircle className='size-5 animate-spin' />
            Checking invitation…
          </div>
        ) : null}

        {invitation ? (
          <>
            <h1 className='mb-0 mt-4 text-4xl font-semibold tracking-tight'>
              Join {invitation.workspaceName}
            </h1>
            <p className='mb-0 mt-3 leading-7 text-muted-foreground'>
              {invitation.invitedByName} invited you as a{' '}
              <strong className='text-foreground'>{invitation.proposedRole}</strong>.
            </p>
            <p className='mb-0 mt-2 text-sm text-muted-foreground'>
              Expires {new Date(invitation.expiresAt).toLocaleString()}.
            </p>

            {!terminal ? <AtlasIdentity viewer={viewer} /> : null}

            {invitation.status === 'pending' ? (
              <div className='mt-5 flex justify-center'>
                <button
                  className='inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-5 font-medium text-primary-foreground disabled:opacity-50'
                  disabled={busy}
                  onClick={onClaim}
                  type='button'
                >
                  {claiming ? <LoaderCircle className='size-4 animate-spin' /> : null}
                  Continue as {viewer.name.split(/\s+/)[0]}
                  <ArrowRight className='size-4' />
                </button>
              </div>
            ) : null}

            {invitation.status === 'claimed' && invitation.claimedByCurrentUser ? (
              <div className='mt-5 flex flex-wrap justify-center gap-3'>
                <button
                  className='inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-5 font-medium text-primary-foreground disabled:opacity-50'
                  disabled={busy}
                  onClick={onAccept}
                  type='button'
                >
                  <Check className='size-4' />
                  Accept invitation
                </button>
                <button
                  className='inline-flex h-11 items-center gap-2 rounded-lg border border-border px-5 font-medium disabled:opacity-50'
                  disabled={busy}
                  onClick={onDecline}
                  type='button'
                >
                  <X className='size-4' />
                  Decline
                </button>
              </div>
            ) : null}

            {terminal ? (
              <div className='mt-8 rounded-xl border border-border bg-muted/35 p-4'>
                <p className='m-0 font-medium capitalize'>Invitation {invitation.status}</p>
                <Link className='mt-3 inline-block text-sm text-primary underline' href='/'>
                  Return to Atlas
                </Link>
              </div>
            ) : null}
          </>
        ) : null}

        {identityMismatch ? (
          <div className='mt-5'>
            <h1 className='mb-0 mt-4 text-4xl font-semibold tracking-tight'>
              Use the invited account
            </h1>
            <p className='mb-0 mt-3 leading-7 text-muted-foreground'>
              This invitation is addressed to a different Atlas or GitHub identity. Atlas will
              not reveal its details or grant access unless the signed-in account proves that
              exact identity.
            </p>
            <AtlasIdentity viewer={viewer} />
            <div className='mt-6 flex flex-wrap justify-center gap-3'>
              <button
                className='inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-5 font-medium text-primary-foreground disabled:opacity-50'
                disabled={switchingAccount}
                onClick={onUseAnotherAccount}
                type='button'
              >
                {switchingAccount ? (
                  <LoaderCircle className='size-4 animate-spin' />
                ) : (
                  <LogOut className='size-4' />
                )}
                Use another account
              </button>
              <Link
                className='inline-flex h-11 items-center gap-2 rounded-lg border border-border px-5 font-medium text-foreground'
                href='/'
              >
                <ArrowLeft className='size-4' />
                Return to Atlas
              </Link>
            </div>
          </div>
        ) : null}

        {error && !identityMismatch ? (
          <div className='mt-8 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive'>
            {error}
          </div>
        ) : null}
      </section>
    </main>
  );
};
