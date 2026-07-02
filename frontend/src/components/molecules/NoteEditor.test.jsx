import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useAuth0 } from '@auth0/auth0-react';
import NoteEditor from './NoteEditor.jsx';

vi.mock('../../api/client.js', () => ({
  request: vi.fn().mockResolvedValue({ ok: true })
}));

vi.mock('@auth0/auth0-react', () => ({
  useAuth0: vi.fn(() => ({
    isAuthenticated: true,
    user: { sub: 'auth0|test', email: 'test@test.com' }
  }))
}));

describe('NoteEditor', () => {
  it('renders textarea when authenticated', () => {
    render(<NoteEditor domain="example.com" />);
    expect(screen.getByPlaceholderText('Add a note about this domain...')).toBeInTheDocument();
  });

  it('shows nothing when not authenticated', () => {
    vi.mocked(useAuth0).mockReturnValueOnce({ isAuthenticated: false });
    const { container } = render(<NoteEditor domain="example.com" />);
    expect(container.innerHTML).toBe('');
  });

  it('shows a saved badge after saving', async () => {
    const user = userEvent.setup();

    render(<NoteEditor domain="example.com" />);

    await user.type(screen.getByPlaceholderText('Add a note about this domain...'), 'Looks good');
    await user.click(screen.getByRole('button', { name: 'Save Note' }));

    expect(await screen.findByText('Note saved')).toHaveAttribute('data-slot', 'badge');
  });
});
