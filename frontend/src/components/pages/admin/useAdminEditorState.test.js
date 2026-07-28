import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import useAdminEditorState from './useAdminEditorState.js';
import { createEmptyPluginDraft, createEmptyThemeDraft } from './drafts.js';

function createMutation() {
  return {
    mutate: vi.fn(),
    reset: vi.fn(),
    isSuccess: false,
    isPending: false
  };
}

function buildOptions() {
  return {
    managedPlugins: [],
    managedThemes: [],
    pluginsQuery: {
      data: { plugins: [] },
      refetch: vi.fn()
    },
    createPluginMutation: createMutation(),
    updatePluginMutation: createMutation(),
    createThemeMutation: createMutation(),
    updateThemeMutation: createMutation(),
    setActiveSection: vi.fn()
  };
}

describe('useAdminEditorState', () => {
  it('clears plugin validation when plugin draft changes', () => {
    const { result } = renderHook(() => useAdminEditorState(buildOptions()));

    act(() => result.current.handlePluginSave());
    expect(result.current.pluginValidationError).toBe('Plugin ID is required.');

    act(() => result.current.setPluginDraft((draft) => ({ ...draft, id: 'new-plugin' })));
    expect(result.current.pluginValidationError).toBe('');
  });

  it('resets plugin create state from mutation success callback', () => {
    const options = buildOptions();
    const { result } = renderHook(() => useAdminEditorState(options));

    act(() => result.current.handleOpenCreatePluginModal());
    options.createPluginMutation.reset.mockClear();
    act(() => result.current.setPluginDraft({
      ...createEmptyPluginDraft(),
      id: 'new-plugin',
      label: 'New plugin'
    }));
    act(() => result.current.handlePluginSave());

    const onSuccess = options.createPluginMutation.mutate.mock.calls[0][1].onSuccess;
    act(() => onSuccess());

    expect(result.current.showCreatePluginModal).toBe(false);
    expect(result.current.pluginDraft).toEqual(createEmptyPluginDraft());
    expect(options.createPluginMutation.reset).toHaveBeenCalledTimes(1);
  });

  it('resets plugin edit state from mutation success callback', () => {
    const options = buildOptions();
    const { result } = renderHook(() => useAdminEditorState({
      ...options,
      managedPlugins: [{ id: 'existing-plugin' }]
    }));

    act(() => result.current.startEditing({ id: 'existing-plugin', label: 'Existing plugin' }));
    act(() => result.current.handlePluginSave());

    const onSuccess = options.updatePluginMutation.mutate.mock.calls[0][1].onSuccess;
    act(() => onSuccess());

    expect(result.current.editingPluginId).toBe(null);
    expect(result.current.pluginDraft).toEqual(createEmptyPluginDraft());
    expect(options.updatePluginMutation.reset).toHaveBeenCalledTimes(1);
  });

  it('resets theme create and edit state from mutation success callbacks', () => {
    const createOptions = buildOptions();
    const { result: createResult } = renderHook(() => useAdminEditorState(createOptions));

    act(() => createResult.current.handleOpenCreateThemeModal());
    act(() => createResult.current.setThemeDraft({
      ...createEmptyThemeDraft(),
      id: 'new-theme',
      label: 'New theme',
      pathSignals: '/wp-content/themes/new-theme/'
    }));
    act(() => createResult.current.handleThemeSave());
    act(() => createOptions.createThemeMutation.mutate.mock.calls[0][1].onSuccess());

    expect(createResult.current.showCreateThemeModal).toBe(false);
    expect(createResult.current.themeDraft).toEqual(createEmptyThemeDraft());

    const updateOptions = buildOptions();
    const { result: updateResult } = renderHook(() => useAdminEditorState({
      ...updateOptions,
      managedThemes: [{ id: 'existing-theme' }]
    }));

    act(() => updateResult.current.startEditingTheme({ id: 'existing-theme', label: 'Existing theme' }));
    act(() => updateResult.current.setThemeDraft((draft) => ({
      ...draft,
      pathSignals: '/wp-content/themes/existing-theme/'
    })));
    act(() => updateResult.current.handleThemeSave());
    act(() => updateOptions.updateThemeMutation.mutate.mock.calls[0][1].onSuccess());

    expect(updateResult.current.editingThemeId).toBe(null);
    expect(updateResult.current.themeDraft).toEqual(createEmptyThemeDraft());
  });
});
