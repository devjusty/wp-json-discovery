import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import UserMenu from './UserMenu';

const logout = vi.fn();
const authState = vi.hoisted(() => ({
  isAuthenticated: true,
  user: {
    name: 'Justin Example',
    picture: 'https://example.com/avatar.png'
  }
}));

vi.mock('@auth0/auth0-react', () => ({
  useAuth0: () => ({
    ...authState,
    logout
  })
}));

describe('UserMenu', () => {
  beforeEach(() => {
    authState.user = {
      name: 'Justin Example',
      picture: 'https://example.com/avatar.png'
    };
    logout.mockClear();
  });

  it('shows avatar without duplicate visible display name', () => {
    render(<UserMenu />);

    expect(screen.getByRole('button', { name: /justin example/i })).toBeInTheDocument();
    expect(screen.queryByText('Justin Example')).not.toBeInTheDocument();
    expect(screen.getByAltText('')).toHaveAttribute('src', 'https://example.com/avatar.png');
  });

  it('shows display name when avatar is unavailable', () => {
    authState.user = { name: 'Justin Example', picture: undefined };

    render(<UserMenu />);

    expect(screen.getByRole('button', { name: /justin example/i })).toHaveTextContent('Justin Example');
  });

  it('opens the dropdown menu and navigates from the menu items', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();

    render(<UserMenu onNavigate={onNavigate} />);

    await user.click(screen.getByRole('button', { name: /justin example/i }));

    expect(screen.getByRole('menu')).toHaveAttribute('data-slot', 'dropdown-menu-content');
    await user.click(screen.getByRole('menuitem', { name: 'Investigations' }));

    expect(onNavigate).toHaveBeenCalledWith('investigations');
  });

  it('logs out from the dropdown menu', async () => {
    const user = userEvent.setup();

    render(<UserMenu onNavigate={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /justin example/i }));
    await user.click(screen.getByRole('menuitem', { name: 'Log out' }));

    expect(logout).toHaveBeenCalledWith({
      logoutParams: {
        returnTo: window.location.origin
      }
    });
  });
});
