import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import SaveScanButton from './SaveScanButton.jsx';

vi.mock('@auth0/auth0-react', () => ({
  useAuth0: () => ({ isAuthenticated: true })
}));

vi.mock('../../../api/client.js', () => ({
  request: vi.fn().mockResolvedValue({ ok: true })
}));

describe('SaveScanButton', () => {
  it('shows the saved badge after saving', async () => {
    const user = userEvent.setup();
    render(<SaveScanButton domain="example.com" onSaved={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Save to My Scans' }));

    expect(await screen.findByText('Saved to My Scans')).toHaveAttribute('data-slot', 'badge');
  });
});
