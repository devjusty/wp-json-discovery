import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DomainsPage from './DomainsPage.jsx';

const setDomain = vi.fn();
const startScan = vi.fn();
const setActivePage = vi.fn();
const updateWarningStatus = vi.fn(async () => ({}));
const startSitemapScan = vi.fn();

vi.mock('../../context/ScanContext.jsx', () => ({
  useScanShellContext: () => ({
    activeDomain: 'example.com',
    setDomain,
    startScan,
    setActivePage,
  })
}));

vi.mock('../../hooks/useDomainTrust.js', () => ({
  useDomainTrust: () => ({
    trust: {
      status: 'warning',
      unresolvedCount: 1,
      envelope: { scannedAt: '2026-04-21T00:00:00.000Z' },
      warnings: [{ id: 7, ruleCode: 'SCAN_CATALOG_MISMATCH', severity: 'warning', reason: 'Missing catalog match', status: 'open' }]
    },
    isLoading: false,
    isUpdating: false,
    error: null,
    updateWarningStatus,
  })
}));

vi.mock('../../hooks/useSitemapScan.js', () => ({
  useSitemapScan: () => ({
    startSitemapScan,
    result: null,
    isRunning: false,
  })
}));

describe('DomainsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows trust warnings and supports remediation actions', async () => {
    render(<DomainsPage />);

    expect(screen.getByText('Missing catalog match')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Resolve' }));
    expect(updateWarningStatus).toHaveBeenCalledWith({ id: 7, status: 'resolved' });
  });

  it('triggers deep audit and re-scan actions', async () => {
    render(<DomainsPage />);

    await userEvent.click(screen.getByRole('button', { name: 'Run deep audit' }));
    expect(startSitemapScan).toHaveBeenCalledWith({
      domain: 'example.com',
      sitemapUrl: 'https://example.com/sitemap.xml',
      maxPages: 25,
    });

    await userEvent.click(screen.getByRole('button', { name: 'Re-scan now' }));
    expect(startScan).toHaveBeenCalledWith('example.com');
    expect(setActivePage).toHaveBeenCalledWith('scan');
  });
});
