import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { getAtlasRequestAccess } from '@/auth/server';
import { AtlasMark } from '@/components/atlas-mark';
import { AuthControl } from '@/components/auth/auth-control';

export const dynamic = 'force-dynamic';

type SignInPageProps = {
  searchParams?: { error?: string | string[] };
};

const SignInPage = async ({ searchParams }: SignInPageProps) => {
  const access = await getAtlasRequestAccess(headers());

  if (access.viewer && access.canRead) {
    redirect('/');
  }

  const error = Array.isArray(searchParams?.error) ? searchParams?.error[0] : searchParams?.error;

  return (
    <main className='grid min-h-screen place-items-center bg-background px-5 py-12'>
      <section className='w-full max-w-sm rounded-2xl border border-border/80 bg-card p-6 shadow-2xl'>
        <div className='flex items-center gap-3'>
          <AtlasMark className='size-10' priority />
          <div>
            <h1 className='m-0 text-xl font-semibold tracking-tight'>Sign in to Atlas</h1>
            <p className='m-0 mt-1 text-sm text-muted-foreground'>Continue with your GitHub identity.</p>
          </div>
        </div>

        {access.configurationError ? (
          <div className='mt-6 rounded-lg border border-destructive/35 bg-destructive/10 p-3 text-sm text-destructive'>
            {access.configurationError}
          </div>
        ) : null}

        {error ? (
          <div className='mt-6 rounded-lg border border-destructive/35 bg-destructive/10 p-3 text-sm text-destructive'>
            GitHub sign-in was rejected ({error}).
          </div>
        ) : null}

        <AuthControl
          authAvailable={access.authAvailable}
          className='mt-6'
          variant='sign-in'
          viewer={access.viewer}
        />

        {!access.authAvailable && !access.configurationError ? (
          <p className='mt-6 text-sm text-muted-foreground'>GitHub authentication is not configured for this deployment.</p>
        ) : null}
      </section>
    </main>
  );
};

export default SignInPage;
