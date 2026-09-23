import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AppShell } from './AppShell';
import { InvestigatorShell } from './InvestigatorShell';

describe('InvestigatorShell', () => {
  it('provides one main landmark and keyboard navigation', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    render(<AppShell navigation={{ items: [{ id: 'scan', label: 'Scan' }, { id: 'admin', label: 'Admin' }], activeId: 'scan' }} commands={{ onNavigate }}><p>content</p></AppShell>);

    expect(screen.getByRole('main')).toHaveTextContent('content');
    await user.tab();
    await user.tab();
    await user.keyboard('{Enter}');
    expect(onNavigate).toHaveBeenCalledWith('admin');
  });

  it('exposes partial state and scoped retry', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<InvestigatorShell readModel={{ title: 'example.com', status: 'partial', sections: [{ id: 'overview', label: 'Overview' }] }} commands={{ onSectionChange: vi.fn(), onRetry }}><p>investigation</p></InvestigatorShell>);

    expect(screen.getByText('Partial investigation')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry failed capability' }));
    expect(onRetry).toHaveBeenCalled();
  });
});
