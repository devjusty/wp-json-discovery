import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AdminShell } from './AdminShell';

describe('AdminShell', () => {
  it('uses distinct admin navigation labeling', () => {
    render(<AdminShell navigation={{ items: [{ id: 'queue', label: 'Review queue' }], activeId: 'queue' }} commands={{ onNavigate: vi.fn() }}><p>admin content</p></AdminShell>);

    expect(screen.getByRole('navigation', { name: 'Admin navigation' })).toBeInTheDocument();
    expect(screen.getByText('Admin workspace')).toBeInTheDocument();
    expect(screen.getAllByRole('main')).toHaveLength(1);
  });

  it('forwards auth actions to the app shell', () => {
    render(
      <AdminShell
        navigation={{ items: [], activeId: '' }}
        commands={{ onNavigate: vi.fn() }}
        authActions={<button type="button">Log in</button>}
      >
        <p>admin content</p>
      </AdminShell>,
    );

    expect(screen.getByRole('group', { name: 'Header actions' })).toContainElement(screen.getByRole('button', { name: 'Log in' }));
  });
});
