'use client';

import mermaid from 'mermaid';
import { useEffect, useId, useState } from 'react';

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
    <div
      className={
        variant === 'atlas-state'
          ? 'overflow-x-auto px-2 py-1 [&_svg]:mx-auto [&_svg]:max-h-[28rem]'
          : 'overflow-x-auto rounded border p-4'
      }
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  ) : (
    <p className='text-sm text-muted-foreground'>Rendering diagram…</p>
  );
};
