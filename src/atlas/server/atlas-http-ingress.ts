import {
  createGraphHttpIngressOperationDispatcher,
  createGraphHttpIngressRouter,
} from '@ontahi/core/runtime/server/ingress';
import { createOperationInvocationDispatcher } from '@ontahi/core/runtime/server';
import { revalidateTag } from 'next/cache';

import { createAtlasOntahiApplication } from '../domain/atlas-application';
import { requireAtlasGitHubWebhookSecret } from '../github/app-config';
import { githubRepositoryCacheTag } from '../github/repository';
import { createAtlasGitHubWebhookIngressProvider } from '../github/webhook-ingress-provider';

const atlas = createAtlasOntahiApplication([], {
  invalidateRepository: repositoryFullName => {
    revalidateTag(githubRepositoryCacheTag(repositoryFullName));
  },
});

const atlasHttpIngressRouter = createGraphHttpIngressRouter({
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

export const handleAtlasHttpIngress = (request: Request) =>
  atlasHttpIngressRouter.handle(request);
