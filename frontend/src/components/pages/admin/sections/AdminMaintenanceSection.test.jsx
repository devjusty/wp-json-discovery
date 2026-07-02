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
});
