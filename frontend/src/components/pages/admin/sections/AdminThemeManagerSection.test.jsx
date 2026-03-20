import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminThemeManagerSection from './AdminThemeManagerSection.jsx';

function buildProps(overrides = {}) {
  return {
    sortThemesMutation: {
      mutate: vi.fn(),
      isPending: false
    },
    themesQuery: {
      isLoading: false,
      isError: false,
      error: null
    },
    managedThemes: [
      {
        id: 'astra',
        label: 'Astra',
        themeUrl: 'https://wordpress.org/themes/astra/',
        description: 'Fast multipurpose theme',
        namespaceHints: ['astra-theme-css'],
        pathSignals: ['/wp-content/themes/astra']
      }
    ],
    themeDraft: {
      id: '',
      label: '',
      description: '',
      themeUrl: '',
      namespaceHints: '',
      pathSignals: ''
    },
    setThemeDraft: vi.fn(),
    editingThemeId: null,
    createThemePending: false,
    updateThemePending: false,
    onThemeSave: vi.fn(),
    onThemeReset: vi.fn(),
    themeValidationError: '',
    themeSaveError: '',
    onOpenCreateModal: vi.fn(),
    showCreateModal: false,
    onCloseCreateModal: vi.fn(),
    startEditingTheme: vi.fn(),
    deleteThemeMutation: {
      mutate: vi.fn(),
      isPending: false
    },
    ...overrides
  };
}

describe('AdminThemeManagerSection', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('supports sort/edit/delete actions', async () => {
    const sortThemesMutation = { mutate: vi.fn(), isPending: false };
    const onOpenCreateModal = vi.fn();
    const startEditingTheme = vi.fn();
    const deleteThemeMutation = { mutate: vi.fn(), isPending: false };
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(
        <AdminThemeManagerSection
          {...buildProps({ sortThemesMutation, onOpenCreateModal, startEditingTheme, deleteThemeMutation })}
        />
      );

    await userEvent.click(screen.getByRole('button', { name: 'Sort themes' }));
    expect(sortThemesMutation.mutate).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole('button', { name: 'Add theme' }));
    expect(onOpenCreateModal).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(startEditingTheme).toHaveBeenCalledWith(expect.objectContaining({ id: 'astra' }));

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(deleteThemeMutation.mutate).toHaveBeenCalledWith('astra');
  });
});
