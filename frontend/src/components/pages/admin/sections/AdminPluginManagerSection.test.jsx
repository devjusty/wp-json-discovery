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

  it('supports sort/edit/delete actions', async () => {
    const sortPluginsMutation = { mutate: vi.fn(), isPending: false };
    const startEditing = vi.fn();
    const deletePluginMutation = { mutate: vi.fn(), isPending: false };
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(
      <AdminPluginManagerSection
        {...buildProps({ sortPluginsMutation, startEditing, deletePluginMutation })}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: 'Sort plugins' }));
    expect(sortPluginsMutation.mutate).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(startEditing).toHaveBeenCalledWith(expect.objectContaining({ id: 'woocommerce' }));

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(deletePluginMutation.mutate).toHaveBeenCalledWith('woocommerce');
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

    expect(screen.getByText('Load failed')).toBeInTheDocument();
  });
});
