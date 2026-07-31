import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import ScanSidebarNav from './ScanSidebarNav.jsx';

describe('ScanSidebarNav', () => {
  it('disables scan sections before a session exists', async () => {
    const onSectionChange = vi.fn();
    const onOpenHistory = vi.fn();
    const onOpenAdmin = vi.fn();

    render(
      <ScanSidebarNav
        activeSection="overview"
        hasSession={false}
        onSectionChange={onSectionChange}
        onOpenHistory={onOpenHistory}
        onOpenAdmin={onOpenAdmin}
      />
    );

    expect(screen.getByRole('navigation', { name: 'Scan navigation' })).toBeInTheDocument();

    expect(screen.getByRole('button', { name: 'Overview' }).querySelector('svg')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Overview' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Homepage source/i }).querySelector('svg')).not.toBeNull();
    expect(screen.getByRole('button', { name: /Homepage source/i }).querySelector('[data-slot="badge"]')).toBeNull();
    expect(screen.queryByText('No signals yet')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'History view' }));
    expect(onOpenHistory).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole('button', { name: 'Admin view' }));
    expect(onOpenAdmin).toHaveBeenCalledTimes(1);

    expect(screen.queryByRole('button', { name: 'Unsupported' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Domain recon' })).not.toBeInTheDocument();
    expect(onSectionChange).not.toHaveBeenCalled();
  });

  it('shows admin-only recon navigation for admins', () => {
    render(
      <ScanSidebarNav
        activeSection="overview"
        hasSession
        onSectionChange={vi.fn()}
        isAdmin
      />
    );

    expect(screen.getByRole('button', { name: 'Domain recon' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Unsupported' })).toBeEnabled();
  });

  it('enables unselected capability sections once a session has a domain', async () => {
    const onSectionChange = vi.fn();

    render(
      <ScanSidebarNav
        activeSection="overview"
        hasSession
        onSectionChange={onSectionChange}
        onOpenHistory={vi.fn()}
        onOpenAdmin={vi.fn()}
        isAdmin
      />
    );

    const sitemap = screen.getByRole('button', { name: 'Sitemap scan' });
    expect(sitemap).toBeEnabled();
    await userEvent.click(sitemap);
    expect(onSectionChange).toHaveBeenCalledWith('sitemap');
  });

  it('marks unavailable capability sections without enabling misleading navigation', () => {
    render(
      <ScanSidebarNav
        activeSection="overview"
        hasSession
        session={{ domain: 'example.com', capabilities: { sitemap: { status: 'unavailable' } } }}
        onSectionChange={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: 'Sitemap scan (Unavailable)' })).toBeDisabled();
  });
});
