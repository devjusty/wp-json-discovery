import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import AdditionalScansPanel from './AdditionalScansPanel.jsx';

describe('AdditionalScansPanel', () => {
  it('lists only unselected idle optional capabilities with defaults and run actions', async () => {
    const onRunCapability = vi.fn();
    const user = userEvent.setup();
    render(
      <AdditionalScansPanel
        selectedCapabilityIds={['wordpress']}
        capabilities={{
          homepage: { status: 'idle' },
          sitemap: { status: 'idle' },
          stale: { status: 'success' }
        }}
        onRunCapability={onRunCapability}
      />
    );

    expect(screen.getByRole('heading', { name: 'Additional scans' })).toBeInTheDocument();
    expect(screen.getByText('Homepage')).toBeInTheDocument();
    expect(screen.getByText('Sitemap')).toBeInTheDocument();
    expect(screen.getByText('Default max pages: 50')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Run Sitemap' }));
    expect(onRunCapability).toHaveBeenCalledWith('sitemap');
  });

  it('omits selected and terminal optional capabilities', () => {
    render(
      <AdditionalScansPanel
        selectedCapabilityIds={['homepage', 'wordpress']}
        capabilities={{
          homepage: { status: 'idle' },
          sitemap: { status: 'failed' }
        }}
        onRunCapability={vi.fn()}
      />
    );

    expect(screen.queryByRole('heading', { name: 'Additional scans' })).not.toBeInTheDocument();
  });
});
