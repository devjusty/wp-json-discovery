import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import ScanSidebarNav from './ScanSidebarNav.jsx';

describe('ScanSidebarNav', () => {
  it('handles navigation actions and disabled sections', async () => {
    const onSectionChange = vi.fn();
    const onOpenHistory = vi.fn();
    const onOpenAdmin = vi.fn();

    render(
      <ScanSidebarNav
        activeSection="overview"
        hasScanResult={false}
        homepageNavSummary="No signals yet"
        onSectionChange={onSectionChange}
        onOpenHistory={onOpenHistory}
        onOpenAdmin={onOpenAdmin}
      />
    );

    expect(screen.getByRole('button', { name: 'Overview' })).toBeDisabled();
    expect(screen.getByText('No signals yet')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'History view' }));
    expect(onOpenHistory).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole('button', { name: 'Admin view' }));
    expect(onOpenAdmin).toHaveBeenCalledTimes(1);

    expect(screen.queryByRole('button', { name: 'Unsupported' })).not.toBeInTheDocument();
    expect(onSectionChange).not.toHaveBeenCalled();
  });

  it('enables scan sections once results are available', async () => {
    const onSectionChange = vi.fn();

    render(
      <ScanSidebarNav
        activeSection="overview"
        hasScanResult
        homepageNavSummary="S200 · M3 · A12 · F1"
        onSectionChange={onSectionChange}
        onOpenHistory={vi.fn()}
        onOpenAdmin={vi.fn()}
        isAdmin
      />
    );

    await userEvent.click(screen.getByRole('button', { name: 'Unsupported' }));
    expect(onSectionChange).toHaveBeenCalledWith('unsupported');
  });
});
