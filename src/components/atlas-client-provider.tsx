'use client';

import { createFetchOperationBridgeAdapter } from '@ontahi/react/actions';
import { OntahiGraphProvider } from '@ontahi/react/graph';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

const atlasOperationBridge = createFetchOperationBridgeAdapter({
  endpoint: '/operations',
});
const atlasBrowserRuntime = {};

export const AtlasClientProvider = ({ children }: { children: ReactNode }) => {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <OntahiGraphProvider
        client={false}
        operationBridgeAdapters={[atlasOperationBridge]}
        runtime={atlasBrowserRuntime}
      >
        {children}
      </OntahiGraphProvider>
    </QueryClientProvider>
  );
};
