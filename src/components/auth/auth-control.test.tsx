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
});
