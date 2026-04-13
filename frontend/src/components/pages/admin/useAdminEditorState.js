import { useCallback, useEffect, useState } from 'react';
import {
  createEmptyPluginDraft,
  createEmptyThemeDraft,
  parseDelimitedList,
  slugToLabel
} from './drafts.js';

// Encapsulates plugin/theme editor state, validation, and mutation side effects.

export default function useAdminEditorState({
  managedPlugins,
  managedThemes,
  pluginsQuery,
  createPluginMutation,
  updatePluginMutation,
  createThemeMutation,
  updateThemeMutation,
  setActiveSection
}) {
  const [pluginDraft, setPluginDraft] = useState(createEmptyPluginDraft);
  const [editingPluginId, setEditingPluginId] = useState(null);
  const [pluginValidationError, setPluginValidationError] = useState('');
  const [showCreatePluginModal, setShowCreatePluginModal] = useState(false);

  const [themeDraft, setThemeDraft] = useState(createEmptyThemeDraft);
  const [editingThemeId, setEditingThemeId] = useState(null);
  const [themeValidationError, setThemeValidationError] = useState('');
  const [showCreateThemeModal, setShowCreateThemeModal] = useState(false);

  const resetPluginDraft = useCallback(() => {
    setPluginDraft(createEmptyPluginDraft());
    setPluginValidationError('');
  }, []);

  const cancelPluginEdit = useCallback(() => {
    resetPluginDraft();
    setEditingPluginId(null);
  }, [resetPluginDraft]);

  const resetThemeDraft = useCallback(() => {
    setThemeDraft(createEmptyThemeDraft());
    setThemeValidationError('');
  }, []);

  const cancelThemeEdit = useCallback(() => {
    resetThemeDraft();
    setEditingThemeId(null);
  }, [resetThemeDraft]);

  const resetPluginMutationErrors = useCallback(() => {
    createPluginMutation.reset();
    updatePluginMutation.reset();
  }, [createPluginMutation, updatePluginMutation]);

  const startEditing = useCallback((plugin) => {
    setEditingPluginId(plugin.id);
    setPluginValidationError('');
    setPluginDraft({
      id: plugin.id ?? '',
      label: plugin.label ?? '',
      description: plugin.description ?? '',
      pluginUrl: plugin.pluginUrl ?? '',
      namespaces: (plugin.namespaces ?? []).join('\n'),
      assetHints: (plugin.assetHints ?? []).join('\n')
    });
  }, []);

  const startEditingTheme = useCallback((theme) => {
    setEditingThemeId(theme.id);
    setThemeValidationError('');
    setThemeDraft({
      id: theme.id ?? '',
      label: theme.label ?? '',
      description: theme.description ?? '',
      themeUrl: theme.themeUrl ?? '',
      namespaceHints: (theme.namespaceHints ?? []).join('\n'),
      pathSignals: (theme.pathSignals ?? []).join('\n')
    });
  }, []);

  useEffect(() => {
    if (pluginValidationError) {
      setPluginValidationError('');
    }
  }, [pluginDraft, editingPluginId, pluginValidationError]);

  useEffect(() => {
    if (themeValidationError) {
      setThemeValidationError('');
    }
  }, [themeDraft, editingThemeId, themeValidationError]);

  useEffect(() => {
    if (createPluginMutation.isSuccess) {
      resetPluginDraft();
      setShowCreatePluginModal(false);
      createPluginMutation.reset();
    }
  }, [createPluginMutation, resetPluginDraft]);

  useEffect(() => {
    if (updatePluginMutation.isSuccess) {
      resetPluginDraft();
      setEditingPluginId(null);
      updatePluginMutation.reset();
    }
  }, [updatePluginMutation, resetPluginDraft]);

  useEffect(() => {
    if (createThemeMutation.isSuccess) {
      resetThemeDraft();
      setShowCreateThemeModal(false);
      createThemeMutation.reset();
    }
  }, [createThemeMutation, resetThemeDraft]);

  useEffect(() => {
    if (updateThemeMutation.isSuccess) {
      resetThemeDraft();
      setEditingThemeId(null);
      updateThemeMutation.reset();
    }
  }, [updateThemeMutation, resetThemeDraft]);

  const handlePluginSave = useCallback(() => {
    const payload = {
      id: pluginDraft.id.trim(),
      label: pluginDraft.label.trim(),
      description: pluginDraft.description.trim(),
      pluginUrl: pluginDraft.pluginUrl.trim(),
      namespaces: Array.from(new Set(parseDelimitedList(pluginDraft.namespaces))),
      assetHints: Array.from(new Set(parseDelimitedList(pluginDraft.assetHints)))
    };
    if (!payload.id) {
      setPluginValidationError('Plugin ID is required.');
      return;
    }
    if (!payload.label) {
      setPluginValidationError('Plugin label is required.');
      return;
    }
    if (!editingPluginId && managedPlugins.some((plugin) => plugin.id === payload.id)) {
      setPluginValidationError(`Plugin ID "${payload.id}" already exists.`);
      return;
    }
    setPluginValidationError('');

    if (editingPluginId) {
      updatePluginMutation.mutate({ id: editingPluginId, payload });
    } else {
      createPluginMutation.mutate(payload);
    }
  }, [pluginDraft, editingPluginId, managedPlugins, updatePluginMutation, createPluginMutation]);

  const handleThemeSave = useCallback(() => {
    const payload = {
      id: themeDraft.id.trim(),
      label: themeDraft.label.trim(),
      description: themeDraft.description.trim(),
      themeUrl: themeDraft.themeUrl.trim(),
      namespaceHints: Array.from(new Set(parseDelimitedList(themeDraft.namespaceHints))),
      pathSignals: Array.from(new Set(parseDelimitedList(themeDraft.pathSignals)))
    };

    if (!payload.id) {
      setThemeValidationError('Theme ID is required.');
      return;
    }
    if (!payload.label) {
      setThemeValidationError('Theme label is required.');
      return;
    }
    if (!payload.pathSignals.length) {
      setThemeValidationError('Add at least one path signal before saving.');
      return;
    }
    if (!editingThemeId && managedThemes.some((theme) => theme.id === payload.id)) {
      setThemeValidationError(`Theme ID "${payload.id}" already exists.`);
      return;
    }

    setThemeValidationError('');
    if (editingThemeId) {
      updateThemeMutation.mutate({ id: editingThemeId, payload });
    } else {
      createThemeMutation.mutate(payload);
    }
  }, [themeDraft, editingThemeId, managedThemes, updateThemeMutation, createThemeMutation]);

  const handleCreatePluginFromAsset = useCallback(async (slug) => {
    const normalizedSlug = String(slug ?? '').trim().toLowerCase();
    if (!normalizedSlug) {
      return;
    }

    setActiveSection('plugin-manager');

    let plugins = managedPlugins;
    if (!plugins.length) {
      const fetchResult = await pluginsQuery.refetch();
      plugins = fetchResult?.data?.plugins ?? pluginsQuery.data?.plugins ?? [];
    }

    const existing = plugins.find((plugin) => plugin.id === normalizedSlug);
    resetPluginMutationErrors();

    if (existing) {
      setShowCreatePluginModal(false);
      startEditing(existing);
      return;
    }

    cancelPluginEdit();
    setPluginDraft({
      id: normalizedSlug,
      label: slugToLabel(normalizedSlug),
      description: 'Detected from homepage asset path signal.',
      pluginUrl: `https://wordpress.org/plugins/${normalizedSlug}/`,
      namespaces: '',
      assetHints: normalizedSlug
    });
    setShowCreatePluginModal(true);
  }, [
    managedPlugins,
    pluginsQuery,
    resetPluginMutationErrors,
    startEditing,
    cancelPluginEdit,
    setActiveSection
  ]);

  const handleOpenCreatePluginModal = useCallback(() => {
    resetPluginMutationErrors();
    cancelPluginEdit();
    setShowCreatePluginModal(true);
  }, [resetPluginMutationErrors, cancelPluginEdit]);

  const handleCloseCreatePluginModal = useCallback(() => {
    setShowCreatePluginModal(false);
    cancelPluginEdit();
  }, [cancelPluginEdit]);

  const handleOpenCreateThemeModal = useCallback(() => {
    cancelThemeEdit();
    setShowCreateThemeModal(true);
  }, [cancelThemeEdit]);

  const handleCloseCreateThemeModal = useCallback(() => {
    setShowCreateThemeModal(false);
    cancelThemeEdit();
  }, [cancelThemeEdit]);

  return {
    pluginDraft,
    setPluginDraft,
    editingPluginId,
    pluginValidationError,
    showCreatePluginModal,
    startEditing,
    handlePluginSave,
    cancelPluginEdit,
    handleOpenCreatePluginModal,
    handleCloseCreatePluginModal,
    handleCreatePluginFromAsset,
    themeDraft,
    setThemeDraft,
    editingThemeId,
    themeValidationError,
    showCreateThemeModal,
    startEditingTheme,
    handleThemeSave,
    cancelThemeEdit,
    handleOpenCreateThemeModal,
    handleCloseCreateThemeModal
  };
}
