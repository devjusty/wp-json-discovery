import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DomainForm from './DomainForm.jsx';

describe('DomainForm', () => {
  it('normalizes submitted domains', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<DomainForm initialDomain="https://WWW.Example.com/" onSubmit={onSubmit} />);

    await user.click(screen.getByRole('button', { name: 'Start scan' }));

    expect(onSubmit).toHaveBeenCalledWith('example.com');
  });

  it('passes scan settings actions through its disclosure', async () => {
    const user = userEvent.setup();
    const onScanSettingsChange = vi.fn();
    const onSaveDefaults = vi.fn();

    render(
      <DomainForm
        initialDomain="example.com"
        onSubmit={vi.fn()}
        scanSettings={{ capabilityIds: ['wordpress'], options: { wordpress: {} } }}
        onScanSettingsChange={onScanSettingsChange}
        onSaveDefaults={onSaveDefaults}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Scan settings' }));
    await user.click(screen.getByRole('checkbox', { name: /Homepage/ }));
    await user.click(screen.getByRole('button', { name: 'Save as default' }));

    expect(onScanSettingsChange).toHaveBeenCalledWith({
      capabilityIds: ['homepage', 'wordpress'],
      options: { homepage: {}, wordpress: {} }
    });
    expect(onSaveDefaults).toHaveBeenCalledWith({
      capabilityIds: ['wordpress'],
      options: { wordpress: {} }
    });
  });
});
