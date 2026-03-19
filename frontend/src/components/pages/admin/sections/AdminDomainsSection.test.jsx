import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import AdminDomainsSection from './AdminDomainsSection.jsx';

function buildProps(overrides = {}) {
  return {
    unsupportedEntries: [{ namespace: 'wc/v3', domains: ['alpha.com'] }],
    domainsQuery: '',
    setDomainsQuery: vi.fn(),
    domainsSort: 'domainAsc',
    setDomainsSort: vi.fn(),
    filteredDomainEntries: [{ domain: 'alpha.com', namespaces: ['wc/v3', 'yoast/v1'] }],
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
        {...buildProps({ unsupportedEntries: [], filteredDomainEntries: [] })}
      />
    );

    expect(screen.getByText('No domains recorded.')).toBeInTheDocument();
  });
});
