import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ThemeProvider } from '@/components/theme-provider';

const signInMock = vi.hoisted(() => vi.fn());
const signOutMock = vi.hoisted(() => vi.fn());

vi.mock('@/auth/client', () => ({
  atlasAuthClient: {
    signIn: { social: signInMock },
    signOut: signOutMock,
  },
}));

import { AuthControl } from './auth-control';

describe('AuthControl', () => {
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
    signInMock.mockReset().mockResolvedValue({ data: {}, error: null });
    signOutMock.mockReset().mockResolvedValue({ data: {}, error: null });
    globalThis.localStorage.clear();
    document.documentElement.classList.remove('dark');
    document.documentElement.style.colorScheme = '';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.documentElement.classList.remove('dark');
    document.documentElement.style.colorScheme = '';
  });

  it('stays absent when GitHub auth is not configured', () => {
    const { container } = render(
      <AuthControl authAvailable={false} viewer={null} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('starts the GitHub flow for an anonymous viewer', async () => {
    render(<AuthControl authAvailable viewer={null} />);

    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() =>
      expect(signInMock).toHaveBeenCalledWith({
        callbackURL: '/',
        errorCallbackURL: '/sign-in',
        provider: 'github',
      }),
    );
  });

  it('names the primary landing action after the identity provider', () => {
    render(<AuthControl authAvailable variant='sign-in' viewer={null} />);

    expect(screen.getByRole('button', { name: 'Continue with GitHub' })).toBeInTheDocument();
  });

  it('presents the current viewer and a sign-out action', () => {
    render(
      <AuthControl
        authAvailable
        viewer={{ email: 'javi@example.com', id: '1', image: null, name: 'Javi' }}
      />,
    );

    expect(screen.getByText('Javi')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
  });

  it('keeps viewer chrome avatar-only until its menu opens', () => {
    const { container } = render(
      <ThemeProvider>
        <AuthControl
          authAvailable
          variant='chrome'
          viewer={{ email: 'javi@example.com', id: '1', image: null, name: 'Javi' }}
        />
      </ThemeProvider>,
    );

    expect(screen.getByRole('button', { name: 'Open account menu' })).toBeInTheDocument();
    expect(screen.queryByText('Javi')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sign out' })).not.toBeInTheDocument();
    expect(container.firstElementChild).not.toHaveClass('border', 'shadow-lg', 'backdrop-blur-xl');

    fireEvent.click(screen.getByRole('button', { name: 'Open account menu' }));

    expect(screen.getByText('Javi')).toBeInTheDocument();
    expect(screen.getByText('javi@example.com')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Switch to dark mode' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Sign out' })).toBeInTheDocument();
  });

  it('switches and persists the theme from the account menu', async () => {
    render(
      <ThemeProvider>
        <AuthControl
          authAvailable
          variant='chrome'
          viewer={{ email: 'javi@example.com', id: '1', image: null, name: 'Javi' }}
        />
      </ThemeProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open account menu' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Switch to dark mode' }));

    await waitFor(() => {
      expect(document.documentElement).toHaveClass('dark');
      expect(globalThis.localStorage.getItem('atlas-theme')).toBe('dark');
    });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('keeps viewer chrome aligned with the top detail row', () => {
    const { container } = render(
      <ThemeProvider>
        <AuthControl
          authAvailable
          className='fixed right-4'
          variant='chrome'
          viewer={{ email: 'javi@example.com', id: '1', image: null, name: 'Javi' }}
        />
      </ThemeProvider>,
    );

    expect(container.firstElementChild).toHaveClass('top-3');
  });
});
