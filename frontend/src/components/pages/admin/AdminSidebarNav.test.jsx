import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AdminSidebarNav from './AdminSidebarNav.jsx';

describe('AdminSidebarNav', () => {
  it('renders icons on the primary navigation items', () => {
    render(
      <AdminSidebarNav
        activeSection="db"
        onNavigate={vi.fn()}
        onSetActiveSection={vi.fn()}
        onPrefetchSection={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: 'Go to current scan' }).querySelector('svg')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'View scan history' }).querySelector('svg')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Admin (current)' }).querySelector('svg')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Data snapshot' }).querySelector('svg')).not.toBeNull();
  });
});
