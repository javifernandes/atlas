import type { AtlasReadAccess } from '@/auth/access';
import { AtlasMark } from '@/components/atlas-mark';
import { AuthControl } from '@/components/auth/auth-control';

type AuthLandingProps = Pick<
  AtlasReadAccess,
  'authAvailable' | 'configurationError' | 'viewer'
> & {
  error?: string | null;
};

export const AuthLanding = ({
  authAvailable,
  configurationError,
  error,
  viewer,
}: AuthLandingProps) => (
  <main className='relative grid min-h-screen place-items-center overflow-hidden bg-background px-5 py-12'>
    <div
      aria-hidden='true'
      className='absolute inset-0 bg-[radial-gradient(circle_at_top,hsl(var(--primary)/0.14),transparent_42%)]'
    />
    <section className='relative w-full max-w-md rounded-3xl border border-border/75 bg-card/90 p-8 shadow-2xl backdrop-blur-xl sm:p-10'>
      <div className='flex flex-col items-center text-center'>
        <AtlasMark className='size-16' priority />
        <p className='mb-0 mt-5 text-xs font-semibold uppercase tracking-[0.28em] text-primary'>
          Workstream Atlas
        </p>
        <h1 className='mb-0 mt-3 text-3xl font-semibold tracking-tight'>Enter Atlas</h1>
        <p className='mb-0 mt-3 max-w-sm text-sm leading-6 text-muted-foreground'>
          Sign in with GitHub to explore the shared Atlas, Ontahí, and BookOps workspace.
        </p>
      </div>

      {configurationError ? (
        <div className='mt-7 rounded-xl border border-destructive/35 bg-destructive/10 p-3 text-sm text-destructive'>
          {configurationError}
        </div>
      ) : null}

      {error ? (
        <div className='mt-7 rounded-xl border border-destructive/35 bg-destructive/10 p-3 text-sm text-destructive'>
          GitHub sign-in was rejected ({error}).
        </div>
      ) : null}

      <AuthControl
        authAvailable={authAvailable}
        className='mt-7'
        variant='sign-in'
        viewer={viewer}
      />

      {!authAvailable && !configurationError ? (
        <p className='mb-0 mt-7 text-center text-sm text-muted-foreground'>
          GitHub authentication is not configured for this deployment.
        </p>
      ) : null}
    </section>
  </main>
);
