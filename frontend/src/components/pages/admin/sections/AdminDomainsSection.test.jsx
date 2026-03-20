import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import AdminDomainsSection from './AdminDomainsSection.jsx';

function buildProps(overrides = {}) {
  return {
    totalDomainEntries: 1,
    domainsQuery: '',
    setDomainsQuery: vi.fn(),
    domainsSort: 'recent',
    setDomainsSort: vi.fn(),
    filteredDomainEntries: [{
      domain: 'alpha.com',
      firstScannedAt: '2026-03-01T10:00:00.000Z',
      lastScannedAt: '2026-03-02T10:00:00.000Z',
      lastStatus: 'failed',
      lastDurationMs: 1234,
      lastErrorCategory: 'timeout',
      lastUnsupportedCount: 2
    }],
    expandedDomainRows: new Set(),
    setExpandedDomainRows: vi.fn(),
    onRescan: vi.fn(),
    ...overrides
  };
}

describe('AdminDomainsSection', () => {
  it('renders rows and triggers domain actions', async () => {
    const setExpandedDomainRows = vi.fn();
    const onRescan = vi.fn();

    render(
      <AdminDomainsSection
        {...buildProps({ setExpandedDomainRows, onRescan })}
      />
    );

    expect(screen.getByText('alpha.com')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'alpha.com' }));
    expect(setExpandedDomainRows).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole('button', { name: 'Rescan' }));
    expect(onRescan).toHaveBeenCalledWith('alpha.com');
  });

  it('shows empty copy when no domains are present', () => {
    render(
      <AdminDomainsSection
        {...buildProps({ totalDomainEntries: 0, filteredDomainEntries: [] })}
      />
    );

    expect(screen.getByText('No scanned domains found.')).toBeInTheDocument();
  });
});
