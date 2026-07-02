import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import AdminPluginManagerSection from './AdminPluginManagerSection.jsx';

function buildProps(overrides = {}) {
  return {
    sortPluginsMutation: {
      mutate: vi.fn(),
      isPending: false
    },
    pluginsQuery: {
      isLoading: false,
      isError: false,
      error: null
    },
    managedPlugins: [
      {
        id: 'woocommerce',
        label: 'WooCommerce',
        pluginUrl: 'https://wordpress.org/plugins/woocommerce/',
        description: 'Commerce plugin',
        namespaces: ['wc/v3'],
        assetHints: ['woocommerce']
      }
    ],
    pluginDraft: {
      id: '',
      label: '',
      description: '',
      pluginUrl: '',
      namespaces: '',
      assetHints: ''
    },
    setPluginDraft: vi.fn(),
    editingPluginId: null,
    createPluginPending: false,
    updatePluginPending: false,
    onPluginSave: vi.fn(),
    onPluginReset: vi.fn(),
    pluginValidationError: '',
    pluginSaveError: '',
    onOpenCreateModal: vi.fn(),
    showCreateModal: false,
    onCloseCreateModal: vi.fn(),
    startEditing: vi.fn(),
    deletePluginMutation: {
      mutate: vi.fn(),
      isPending: false
    },
    ...overrides
  };
}

describe('AdminPluginManagerSection', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the create action in a shadcn card action slot', () => {
    render(<AdminPluginManagerSection {...buildProps()} />);

    expect(screen.getByRole('button', { name: 'Add plugin' }).closest('[data-slot="card-action"]')).toBeInTheDocument();
  });

  it('supports sort/edit/delete actions', async () => {
    const sortPluginsMutation = { mutate: vi.fn(), isPending: false };
    const onOpenCreateModal = vi.fn();
    const startEditing = vi.fn();
    const deletePluginMutation = { mutate: vi.fn(), isPending: false };

    render(
        <AdminPluginManagerSection
          {...buildProps({ sortPluginsMutation, onOpenCreateModal, startEditing, deletePluginMutation })}
        />
      );

    expect(screen.getByRole('table', { name: 'Plugin manager' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Sort plugins' }));
    expect(sortPluginsMutation.mutate).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole('button', { name: 'Add plugin' }));
    expect(onOpenCreateModal).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(startEditing).toHaveBeenCalledWith(expect.objectContaining({ id: 'woocommerce' }));

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(await screen.findByRole('alertdialog', { name: /delete plugin/i })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Delete plugin' }));
    expect(deletePluginMutation.mutate).toHaveBeenCalledWith('woocommerce');
  });

  it('opens a delete alert dialog before deleting a plugin', async () => {
    const deletePluginMutation = { mutate: vi.fn(), isPending: false };

    render(
      <AdminPluginManagerSection
        {...buildProps({ deletePluginMutation })}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(await screen.findByRole('alertdialog', { name: /delete plugin/i })).toBeInTheDocument();
  });

  it('shows loading and error states', () => {
    const { rerender } = render(
      <AdminPluginManagerSection
        {...buildProps({ pluginsQuery: { isLoading: true, isError: false, error: null } })}
      />
    );

    expect(screen.getByText('Loading plugins…')).toBeInTheDocument();

    rerender(
      <AdminPluginManagerSection
        {...buildProps({
          pluginsQuery: { isLoading: false, isError: true, error: { message: 'Load failed' } }
        })}
      />
    );

    const errorCard = screen.getByText('Load failed').closest('.card--error');
    expect(errorCard).toHaveAttribute('data-slot', 'card');
  });
});
