import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import AppLayout from './AppLayout.jsx';

describe('AppLayout', () => {
  it('opens sidebar navigation in a shadcn sheet', async () => {
    const user = userEvent.setup();

    render(
      <AppLayout title="Admin" sidebar={<div>Sidebar content</div>} onNavigate={vi.fn()}>
        <p>Main content</p>
      </AppLayout>
    );

    await user.click(screen.getByRole('button', { name: 'Open navigation' }));

    const dialog = await screen.findByRole('dialog', { name: 'Navigation' });
    expect(within(dialog).getByText('Sidebar content')).toBeInTheDocument();
  });
});
