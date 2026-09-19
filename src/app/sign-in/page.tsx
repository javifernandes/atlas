import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { getAtlasRequestAccess } from '@/auth/server';
import { AuthLanding } from '@/components/auth/auth-landing';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { robots: { follow: false, index: false } };

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
    <AuthLanding
      authAvailable={access.authAvailable}
      configurationError={access.configurationError}
      error={error}
      viewer={access.viewer}
    />
  );
};

export default SignInPage;
