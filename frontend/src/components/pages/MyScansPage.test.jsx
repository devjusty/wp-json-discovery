import { render, screen, within } from '@testing-library/react';
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
  }),
  clearUserSavedScans: vi.fn().mockResolvedValue({ ok: true })
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

    const savedScansRegion = screen.getByRole('region', { name: 'Saved scans' });
    expect(within(savedScansRegion).getByRole('table', { name: 'Saved scans' })).toBeInTheDocument();

    const domainButton = await screen.findByRole('button', { name: /example\.com/i });
    await user.click(domainButton);
    expect(onUseDomain).toHaveBeenCalledWith('example.com');

    await user.click(screen.getByRole('button', { name: /scan again/i }));
    expect(onRescan).toHaveBeenCalledWith('example.com');

    expect(screen.getByRole('main')).toHaveClass('app__main--full-width');
  });

  it('confirms before clearing saved scans', async () => {
    const user = userEvent.setup();
    const { clearUserSavedScans } = await import('../../api/client.js');

    render(
      <MyScansPage
        headerActions={null}
        onNavigate={vi.fn()}
        onUseDomain={vi.fn()}
        onRescan={vi.fn()}
      />
    );

    await user.click(await screen.findByRole('button', { name: /clear saved scans/i }));
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: /clear saved scans/i }));

    expect(clearUserSavedScans).toHaveBeenCalledTimes(1);
  });
});
