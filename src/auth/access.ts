import type { Principal } from '@ontahi/core/runtime/server';

import type { AtlasAuthConfiguration } from './config';

export type AtlasViewer = {
  email: string;
  id: string;
  image: string | null;
  name: string;
};

export type AtlasReadAccess = {
  authAvailable: boolean;
  canRead: boolean;
  configurationError: string | null;
  principal: Principal | null;
  viewer: AtlasViewer | null;
  visibility: AtlasAuthConfiguration['visibility'];
};

export const atlasViewerToPrincipal = (viewer: AtlasViewer | null): Principal | null =>
  viewer
    ? {
        issuer: 'atlas',
        kind: 'user',
        subject: viewer.id,
      }
    : null;

export const decideAtlasReadAccess = (
  configuration: AtlasAuthConfiguration,
  viewer: AtlasViewer | null,
): AtlasReadAccess => ({
  authAvailable: configuration.authAvailable,
  canRead:
    !configuration.configurationError &&
    (configuration.visibility === 'public' || viewer !== null),
  configurationError: configuration.configurationError,
  principal: atlasViewerToPrincipal(viewer),
  viewer,
  visibility: configuration.visibility,
});
