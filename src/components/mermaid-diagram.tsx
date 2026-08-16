'use client';

import mermaid from 'mermaid';
import { useEffect, useId, useState } from 'react';

import { useTheme } from './theme-provider';

export const MermaidDiagram = ({ code }: { code: string }) => {
  const { theme } = useTheme();
  const id = `atlas-mermaid-${useId().replaceAll(':', '-')}`;
  const [svg, setSvg] = useState<string>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;

    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: theme === 'dark' ? 'dark' : 'default',
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
  }, [code, id, theme]);

  if (error) {
    return <pre className='overflow-x-auto rounded border p-4 text-sm'>{error}</pre>;
  }

  return svg ? (
    <div className='overflow-x-auto rounded border p-4' dangerouslySetInnerHTML={{ __html: svg }} />
  ) : (
    <p className='text-sm text-muted-foreground'>Rendering diagram…</p>
  );
};
