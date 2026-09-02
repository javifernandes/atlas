import {
  createGraphHttpIngressOperationDispatcher,
  createGraphHttpIngressRouter,
} from '@ontahi/core/runtime/server/ingress';
import { createOperationInvocationDispatcher } from '@ontahi/core/runtime/server';

import { requireAtlasGitHubWebhookSecret } from '../github/app-config';
import { createAtlasGitHubWebhookIngressProvider } from '../github/webhook-ingress-provider';
import { getAtlasServerApplication } from './atlas-composition';

export const handleAtlasHttpIngress = async (request: Request) => {
  const atlas = await getAtlasServerApplication();
  const router = createGraphHttpIngressRouter({
    routes: atlas.application.graph.listHttpIngress(),
    providers: {
      'github-webhook': createAtlasGitHubWebhookIngressProvider({
        getSecret: requireAtlasGitHubWebhookSecret,
      }),
    },
    dispatch: createGraphHttpIngressOperationDispatcher({
      dispatcher: createOperationInvocationDispatcher(atlas.application),
    }),
  });

  return router.handle(request);
};
