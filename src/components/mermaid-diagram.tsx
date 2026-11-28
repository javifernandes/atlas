'use client';

import mermaid from 'mermaid';
import { Maximize2 } from 'lucide-react';
import { useEffect, useId, useState } from 'react';

import { Modal } from './ui/modal';
import { useTheme } from './theme-provider';

type MermaidDiagramVariant = 'atlas-state' | 'default';

const atlasStateTheme = (dark: boolean) => ({
  darkMode: dark,
  background: 'transparent',
  fontFamily: 'var(--font-sans), ui-sans-serif, system-ui, sans-serif',
  lineColor: dark ? '#52615f' : '#82908e',
  primaryBorderColor: dark ? '#344744' : '#a6b8b4',
  primaryColor: dark ? '#111716' : '#f7faf9',
  primaryTextColor: dark ? '#e7eeec' : '#26312f',
  secondaryBorderColor: dark ? '#2d3d3a' : '#b6c5c2',
  secondaryColor: dark ? '#0d1211' : '#f0f5f3',
  tertiaryColor: 'transparent',
  transitionColor: dark ? '#60736f' : '#71827e',
});

const atlasStateThemeCss = `
  .statediagram-state rect.basic,
  .stateGroup rect {
    rx: 12px;
    ry: 12px;
    stroke-width: 1px;
  }
  .edgePath path,
  .transition {
    stroke-width: 1.15px;
  }
  .edgeLabel rect,
  .label-container {
    rx: 7px;
    ry: 7px;
    opacity: 0.92;
  }
  .edgeLabel,
  .stateLabel {
    font-size: 13px;
  }
  .state-start,
  .state-end {
    opacity: 0.72;
  }
`;

export const MermaidDiagram = ({
  code,
  variant = 'default',
}: {
  code: string;
  variant?: MermaidDiagramVariant;
}) => {
  const { theme } = useTheme();
  const id = `atlas-mermaid-${useId().replaceAll(':', '-')}`;
  const [svg, setSvg] = useState<string>();
  const [error, setError] = useState<string>();
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let active = true;

    const isAtlasState = variant === 'atlas-state';
    const dark = theme === 'dark';

    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: isAtlasState ? 'base' : dark ? 'dark' : 'default',
      ...(isAtlasState
        ? {
            themeCSS: atlasStateThemeCss,
            themeVariables: atlasStateTheme(dark),
          }
        : {}),
    });
    void mermaid
      .render(id, code)
      .then(result => {
        if (active) {
          setSvg(result.svg);
          setError(undefined);
        }
      })
      .catch(reason => {
        if (active) {
          setSvg(undefined);
          setError(reason instanceof Error ? reason.message : 'Could not render diagram');
        }
      });

    return () => {
      active = false;
    };
  }, [code, id, theme, variant]);

  if (error) {
    return <pre className='overflow-x-auto rounded border p-4 text-sm'>{error}</pre>;
  }

  return svg ? (
    <>
      <div className='group relative'>
        <button
          aria-label='Expand diagram'
          className='absolute right-2 top-2 z-10 inline-grid size-8 place-items-center rounded-md border border-border/70 bg-background/90 text-muted-foreground opacity-80 shadow-sm backdrop-blur transition hover:text-foreground hover:opacity-100 focus-visible:opacity-100'
          onClick={() => setExpanded(true)}
          title='Expand diagram'
          type='button'
        >
          <Maximize2 aria-hidden='true' className='size-4' />
        </button>
        <div
          className={
            variant === 'atlas-state'
              ? 'overflow-x-auto px-2 py-1 pr-12 [&_svg]:mx-auto [&_svg]:max-h-[28rem]'
              : 'overflow-x-auto p-4 pr-12 [&_svg]:mx-auto'
          }
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </div>
      <Modal
        contentClassName='h-[calc(100vh-2rem)] max-h-[calc(100vh-2rem)] max-w-[calc(100vw-2rem)] grid-rows-[auto_minmax(0,1fr)]'
        onClose={() => setExpanded(false)}
        open={expanded}
        title='Diagram preview'
      >
        <div
          className='min-h-0 overflow-auto rounded-lg bg-muted/20 p-6 [&_svg]:mx-auto [&_svg]:h-auto [&_svg]:max-h-none [&_svg]:max-w-none'
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </Modal>
    </>
  ) : (
    <p className='text-sm text-muted-foreground'>Rendering diagram…</p>
  );
};
