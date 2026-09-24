import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import AppLayout from '../../components/templates/AppLayout';
import { AdminShell } from './AdminShell';
import { InvestigatorShell } from './InvestigatorShell';

describe('production route landmark composition', () => {
  it.each(['scan', 'history', 'investigations'])('renders exactly one main landmark for %s route', (route) => {
    render(
      <InvestigatorShell
        readModel={{ title: route, sections: [{ id: 'overview', label: 'Overview' }], capabilities: [] }}
        commands={{ onSectionChange: vi.fn() }}
        contentLandmark="main"
        contentMode="legacy"
        headerActions={<button type="button">New scan</button>}
      >
        <AppLayout title={route} embedded>
          <p>{route} content</p>
        </AppLayout>
      </InvestigatorShell>,
    );

    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'New scan' })).toHaveLength(1);
  });

  it('renders exactly one main landmark for admin route', () => {
    render(
      <AdminShell
        navigation={{ items: [{ id: 'admin', label: 'Admin' }], activeId: 'admin' }}
        commands={{ onNavigate: vi.fn() }}
      >
        <AppLayout title="Admin" embedded>
          <p>admin content</p>
        </AppLayout>
      </AdminShell>,
    );

    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(screen.getAllByRole('banner')).toHaveLength(1);
    expect(screen.getAllByRole('navigation')).toHaveLength(1);
  });
});
