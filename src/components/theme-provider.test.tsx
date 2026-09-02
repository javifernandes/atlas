import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ThemeProvider, useTheme } from './theme-provider';

const ThemeProbe = () => {
  const { theme } = useTheme();

  return <span>{theme}</span>;
};

describe('ThemeProvider', () => {
  beforeEach(() => {
    const values = new Map<string, string>();

    vi.stubGlobal('localStorage', {
      clear: () => values.clear(),
      getItem: (key: string) => values.get(key) ?? null,
      key: (index: number) => [...values.keys()][index] ?? null,
      get length() {
        return values.size;
      },
      removeItem: (key: string) => values.delete(key),
      setItem: (key: string, value: string) => values.set(key, value),
    } satisfies Storage);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.documentElement.classList.remove('dark');
    document.documentElement.style.colorScheme = '';
  });

  it('preserves a stored dark theme while the provider hydrates', async () => {
    globalThis.localStorage.setItem('atlas-theme', 'dark');

    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );

    await waitFor(() => expect(screen.getByText('dark')).toBeInTheDocument());

    expect(document.documentElement).toHaveClass('dark');
    expect(globalThis.localStorage.getItem('atlas-theme')).toBe('dark');
  });
});
