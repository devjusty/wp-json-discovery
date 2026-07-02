import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import UserMenu from './UserMenu.jsx';

const logout = vi.fn();

vi.mock('@auth0/auth0-react', () => ({
  useAuth0: () => ({
    isAuthenticated: true,
    user: {
      name: 'Justin Example',
      picture: 'https://example.com/avatar.png'
    },
    logout
  })
}));

describe('UserMenu', () => {
  it('opens the dropdown menu and navigates from the menu items', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();

    render(<UserMenu onNavigate={onNavigate} />);

    await user.click(screen.getByRole('button', { name: /justin example/i }));

    expect(screen.getByRole('menu')).toHaveAttribute('data-slot', 'dropdown-menu-content');
    await user.click(screen.getByRole('menuitem', { name: 'My Scans' }));

    expect(onNavigate).toHaveBeenCalledWith('my-scans');
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
