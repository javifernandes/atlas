import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const signInMock = vi.hoisted(() => vi.fn());
const signOutMock = vi.hoisted(() => vi.fn());

vi.mock('@/auth/client', () => ({
  atlasAuthClient: {
    signIn: { social: signInMock },
    signOut: signOutMock,
  },
}));

import { AuthControl } from './auth-control';
import { atlasDetailSurfaceChangedEvent } from '@/atlas/viewer/detail-surface-events';

describe('AuthControl', () => {
  beforeEach(() => {
    signInMock.mockReset().mockResolvedValue({ data: {}, error: null });
    signOutMock.mockReset().mockResolvedValue({ data: {}, error: null });
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
      <AuthControl
        authAvailable
        variant='chrome'
        viewer={{ email: 'javi@example.com', id: '1', image: null, name: 'Javi' }}
      />,
    );

    expect(screen.getByRole('button', { name: 'Open account menu' })).toBeInTheDocument();
    expect(screen.queryByText('Javi')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sign out' })).not.toBeInTheDocument();
    expect(container.firstElementChild).not.toHaveClass('border', 'shadow-lg', 'backdrop-blur-xl');

    fireEvent.click(screen.getByRole('button', { name: 'Open account menu' }));

    expect(screen.getByText('Javi')).toBeInTheDocument();
    expect(screen.getByText('javi@example.com')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Sign out' })).toBeInTheDocument();
  });

  it('aligns viewer chrome with detail sections while a focus surface is open', () => {
    const { container } = render(
      <AuthControl
        authAvailable
        className='fixed right-4'
        variant='chrome'
        viewer={{ email: 'javi@example.com', id: '1', image: null, name: 'Javi' }}
      />,
    );

    fireEvent(
      globalThis.window,
      new CustomEvent(atlasDetailSurfaceChangedEvent, { detail: true }),
    );

    expect(container.firstElementChild).toHaveClass('top-[2.875rem]');
  });
});
