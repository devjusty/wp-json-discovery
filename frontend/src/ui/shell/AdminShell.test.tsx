import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AdminShell } from './AdminShell';

describe('AdminShell', () => {
  it('uses distinct admin navigation labeling', () => {
    render(<AdminShell navigation={{ items: [{ id: 'queue', label: 'Review queue' }], activeId: 'queue' }} commands={{ onNavigate: vi.fn() }}><p>admin content</p></AdminShell>);

    expect(screen.getByRole('navigation', { name: 'Admin navigation' })).toBeInTheDocument();
    expect(screen.getByText('Admin workspace')).toBeInTheDocument();
  });
});
