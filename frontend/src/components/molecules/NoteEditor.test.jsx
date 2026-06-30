import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useAuth0 } from '@auth0/auth0-react';
import NoteEditor from './NoteEditor.jsx';

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
});
