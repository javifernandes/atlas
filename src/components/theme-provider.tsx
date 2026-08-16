'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

type Theme = 'dark' | 'light';

const ThemeContext = createContext<{
  theme: Theme;
  toggleTheme: () => void;
} | null>(null);

export const ThemeProvider = ({
  children,
  forcedTheme,
}: {
  children: ReactNode;
  forcedTheme?: Theme;
}) => {
  const [theme, setTheme] = useState<Theme>(forcedTheme ?? 'light');

  useEffect(() => {
    if (forcedTheme) {
      setTheme(forcedTheme);
      return;
    }

    const stored = globalThis.localStorage?.getItem('workstream-atlas-theme');
    const initial =
      stored === 'dark' || stored === 'light'
        ? stored
        : globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light';
    setTheme(initial);
  }, [forcedTheme]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.style.colorScheme = theme;
    if (!forcedTheme) {
      globalThis.localStorage?.setItem('workstream-atlas-theme', theme);
    }
  }, [forcedTheme, theme]);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        toggleTheme: () => {
          if (!forcedTheme) {
            setTheme(value => (value === 'light' ? 'dark' : 'light'));
          }
        },
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }

  return context;
};
