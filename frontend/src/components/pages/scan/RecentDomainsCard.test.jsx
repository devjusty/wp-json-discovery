import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import RecentDomainsCard from './RecentDomainsCard.jsx';

vi.mock('@auth0/auth0-react', () => ({
  useAuth0: () => ({ isAuthenticated: true })
}));

describe('RecentDomainsCard', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('shows saved state for saved scans and a save action for unsaved scans', async () => {
    const user = userEvent.setup();
    const onRescan = vi.fn();

    render(
      <RecentDomainsCard
        items={[
          {
            domain: 'saved.example.com',
            isSaved: true,
            savedAt: '2026-06-30T09:30:00.000Z',
            notes: 'keep this',
            lastScannedAt: '2026-06-30T10:00:00.000Z',
            lastStatus: 'failed'
          },
          {
            domain: 'unsaved.example.com',
            isSaved: false,
            savedAt: null,
            notes: null,
            lastScannedAt: '2026-06-30T12:00:00.000Z',
            lastStatus: 'ok'
          }
        ]}
        isLoading={false}
        isExpanded={true}
        onToggleExpanded={vi.fn()}
        onOpenHistory={vi.fn()}
        onRescan={onRescan}
      />
    );

    expect(screen.getByRole('region', { name: 'Recent scanned domains' })).toBeInTheDocument();

    expect(screen.getByText('Saved to My Scans')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save to my scans/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /unsaved\.example\.com/i }));
    expect(onRescan).toHaveBeenCalledWith('unsaved.example.com');
  });
});
