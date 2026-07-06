import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AdminMaintenanceSection from './AdminMaintenanceSection.jsx';

vi.mock('../../../atoms/Button.jsx', () => ({
  default: ({ children, ...props }) => <button {...props}>{children}</button>
}));

describe('AdminMaintenanceSection', () => {
  it('renders the maintenance action in a shadcn card action slot', () => {
    render(
      <AdminMaintenanceSection
        data={{ dbPath: '/tmp/db', logs: {} }}
        maintenanceMutation={{
          data: null,
          error: null,
          isError: false,
          isPending: false,
          mutate: vi.fn()
        }}
      />
    );

    expect(screen.getByText('Run maintenance').closest('[data-slot="card-action"]')).toBeInTheDocument();
  });

  it('renders maintenance errors inside a shadcn card', () => {
    render(
      <AdminMaintenanceSection
        data={{ dbPath: '/tmp/db', logs: {} }}
        maintenanceMutation={{
          data: null,
          error: new Error('Maintenance failed.'),
          isError: true,
          isPending: false,
          mutate: vi.fn()
        }}
      />
    );

    const errorBlock = screen.getByText('Maintenance failed.').closest('.card--error');

    expect(errorBlock?.getAttribute('data-slot')).toBe('card');
  });

  it('renders local database maintenance stats and integrity details', () => {
    render(
      <AdminMaintenanceSection
        data={{ dbPath: '/tmp/db.sqlite', logs: {} }}
        maintenanceMutation={{
          data: {
            integrity: { ok: true, status: 'ok' },
            maintenanceAt: '2026-07-06T12:00:00.000Z',
            size: { beforeBytes: 512, afterBytes: 256 },
            vacuumRan: true,
            walCheckpoint: { busy: 0, checkpointed: 9, log: 12 }
          },
          error: null,
          isError: false,
          isPending: false,
          mutate: vi.fn()
        }}
      />
    );

    expect(screen.getByText('Size')).toBeInTheDocument();
    expect(screen.getByText('512 B → 256 B')).toBeInTheDocument();
    expect(screen.getByText('WAL checkpoint')).toBeInTheDocument();
    expect(screen.getByText('12 log pages · 9 checkpointed · 0 busy')).toBeInTheDocument();
    expect(screen.getByText('Vacuum')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText('Integrity')).toBeInTheDocument();
    expect(screen.getByText('ok')).toBeInTheDocument();
  });

  it('renders remote maintenance mode and integrity errors without local sqlite details', () => {
    render(
      <AdminMaintenanceSection
        data={{ dbPath: 'https://example-db.turso.io', logs: {} }}
        maintenanceMutation={{
          data: {
            integrity: { error: 'database disk image is malformed', ok: false },
            maintenanceAt: '2026-07-06T12:00:00.000Z',
            mode: 'remote-db',
            size: { beforeBytes: 512, afterBytes: 256 },
            vacuumRan: false,
            walCheckpoint: { busy: 0, checkpointed: 9, log: 12 }
          },
          error: null,
          isError: false,
          isPending: false,
          mutate: vi.fn()
        }}
      />
    );

    expect(screen.getByText('Mode')).toBeInTheDocument();
    expect(screen.getByText('remote-db')).toBeInTheDocument();
    expect(screen.getByText('Integrity')).toBeInTheDocument();
    expect(screen.getByText('Error: database disk image is malformed')).toBeInTheDocument();
    expect(screen.queryByText('Size')).not.toBeInTheDocument();
    expect(screen.queryByText('WAL checkpoint')).not.toBeInTheDocument();
    expect(screen.queryByText('Vacuum')).not.toBeInTheDocument();
  });
});
