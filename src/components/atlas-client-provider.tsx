'use client';

import { createFetchGraphClient, OntahiGraphProvider } from '@ontahi/react/graph';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

const atlasGraphClient = createFetchGraphClient({
  runtimeTransport: { endpoint: '/runtime' },
});
const atlasBrowserRuntime = {};

export const AtlasClientProvider = ({ children }: { children: ReactNode }) => {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <OntahiGraphProvider
        client={atlasGraphClient}
        runtime={atlasBrowserRuntime}
      >
        {children}
      </OntahiGraphProvider>
    </QueryClientProvider>
  );
};
