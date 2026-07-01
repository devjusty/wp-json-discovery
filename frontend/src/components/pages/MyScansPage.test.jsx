import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import MyScansPage from './MyScansPage.jsx';

vi.mock('@auth0/auth0-react', () => ({
  useAuth0: () => ({ isAuthenticated: true, isLoading: false })
}));

vi.mock('../../api/client.js', () => ({
  request: vi.fn().mockResolvedValue({
    ok: true,
    data: {
      domains: [
        {
          domain: 'example.com',
          saved_at: '2026-06-30T09:30:00.000Z',
          last_status: 'ok',
          notes: 'ready'
        }
      ]
    }
  })
}));

describe('MyScansPage', () => {
  it('lets a user open the dashboard for a scan and rescan from the row', async () => {
    const user = userEvent.setup();
    const onUseDomain = vi.fn();
    const onRescan = vi.fn();

    render(
      <MyScansPage
        headerActions={null}
        onNavigate={vi.fn()}
        onUseDomain={onUseDomain}
        onRescan={onRescan}
      />
    );

    const domainButton = await screen.findByRole('button', { name: /example\.com/i });
    await user.click(domainButton);
    expect(onUseDomain).toHaveBeenCalledWith('example.com');

    await user.click(screen.getByRole('button', { name: /scan again/i }));
    expect(onRescan).toHaveBeenCalledWith('example.com');
  });
});
