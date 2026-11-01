'use client';

import { createDiagnosticRuntimeTransportRouter } from '@ontahi/devtools';
import { OntahiDevtools } from '@ontahi/devtools/react';
import {
  createFetchRuntimeTransport,
  createRuntimeGraphClient,
  OntahiGraphProvider,
} from '@ontahi/react/graph';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

const fetchRuntimeTransport = createFetchRuntimeTransport({ endpoint: '/runtime' });
const atlasRuntimeTransport = createDiagnosticRuntimeTransportRouter({
  diagnostics:
    process.env.NODE_ENV === 'production'
      ? false
      : {
          capacity: 200,
          capturePayloads: true,
          // Atlas Runtime Protocol traffic carries no provider credentials. Keeping the complete
          // local request/response makes model-backed Operation behavior inspectable in Devtools.
          redact: value => value,
        },
  transports: { http: fetchRuntimeTransport },
  routing: {
    'graph.read': 'http',
    'graph.command': 'http',
    operation: 'http',
    'model.command': 'http',
    'durable.operation.observe': 'http',
  },
});
const atlasGraphClient = createRuntimeGraphClient({ runtimeTransport: atlasRuntimeTransport });
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
        {process.env.NODE_ENV === 'production' ? null : <OntahiDevtools console={false} />}
      </OntahiGraphProvider>
    </QueryClientProvider>
  );
};
