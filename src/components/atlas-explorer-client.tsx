'use client';

import dynamic from 'next/dynamic';

import Loading from '@/app/loading';

export const AtlasExplorerClient = dynamic(
  () =>
    import('@/atlas/viewer/atlas-explorer').then(module => module.PlanWorkstreamExplorer),
  {
    loading: Loading,
    ssr: false,
  },
);
