import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { InvestigatorSectionSelector } from './InvestigatorSectionSelector';

describe('InvestigatorSectionSelector', () => {
  it('supports keyboard selection and a mobile select', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<InvestigatorSectionSelector sections={[{ id: 'overview', label: 'Overview' }, { id: 'findings', label: 'Findings' }]} activeSection="overview" onChange={onChange} />);

    await user.tab();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Findings' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledWith('findings');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Investigation section' }), 'findings');
    expect(onChange).toHaveBeenCalledWith('findings');
  });
});
