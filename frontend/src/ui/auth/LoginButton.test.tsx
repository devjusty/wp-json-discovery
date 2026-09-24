import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LoginButton from './LoginButton';

const loginWithRedirect = vi.fn();
const authState = {
  isLoading: false,
  isAuthenticated: false,
  loginWithRedirect,
};

vi.mock('@auth0/auth0-react', () => ({
  useAuth0: () => authState,
}));

describe('LoginButton', () => {
  beforeEach(() => {
    authState.isLoading = false;
    authState.isAuthenticated = false;
    loginWithRedirect.mockClear();
  });

  it('shows disabled loading state', () => {
    authState.isLoading = true;

    render(<LoginButton />);

    expect(screen.getByRole('button', { name: 'Loading...' })).toBeDisabled();
  });

  it('logs in when anonymous', async () => {
    const user = userEvent.setup();

    render(<LoginButton />);

    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(loginWithRedirect).toHaveBeenCalledTimes(1);
  });

  it('renders nothing when authenticated', () => {
    authState.isAuthenticated = true;

    render(<LoginButton />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
