import { createElement } from 'react';
import { SectionSuspense } from '../AdminSectionPrimitives.jsx';

// Catalog and manager section renderers for plugin/theme admin flows.

export function renderPluginManagerSection({
  activeSection,
  AdminPluginManagerSection: PluginManagerSection,
  pluginManager
}) {
  if (activeSection !== 'plugin-manager') {
    return null;
  }

  return (
    <SectionSuspense label="Loading plugin manager...">
      {createElement(PluginManagerSection, {
        sortPluginsMutation: pluginManager.sortPluginsMutation,
        pluginsQuery: pluginManager.pluginsQuery,
        managedPlugins: pluginManager.managedPlugins,
        pluginDraft: pluginManager.pluginDraft,
        setPluginDraft: pluginManager.setPluginDraft,
        editingPluginId: pluginManager.editingPluginId,
        createPluginPending: pluginManager.createPluginMutation.isPending,
        updatePluginPending: pluginManager.updatePluginMutation.isPending,
        onPluginSave: pluginManager.handlePluginSave,
        onPluginReset: pluginManager.cancelPluginEdit,
        pluginValidationError: pluginManager.pluginValidationError,
        pluginSaveError: pluginManager.createPluginMutation.error?.message || pluginManager.updatePluginMutation.error?.message || '',
        onOpenCreateModal: pluginManager.handleOpenCreatePluginModal,
        showCreateModal: pluginManager.showCreatePluginModal,
        onCloseCreateModal: pluginManager.handleCloseCreatePluginModal,
        startEditing: pluginManager.startEditing,
        deletePluginMutation: pluginManager.deletePluginMutation,
        pluginSuggestions: pluginManager.pluginSuggestions,
        onCreatePluginFromSuggestion: pluginManager.handleCreatePluginFromSuggestion
      })}
    </SectionSuspense>
  );
}

export function renderPluginCatalogSection({
  activeSection,
  AdminSupportedPluginsSection: SupportedPluginsSection,
  pluginCatalog
}) {
  if (activeSection !== 'plugins') {
    return null;
  }

  return (
    <SectionSuspense label="Loading supported plugins...">
      {createElement(SupportedPluginsSection, {
        totalPlugins: pluginCatalog.managedPlugins.length,
        isLoading: pluginCatalog.pluginsQuery.isLoading,
        isError: pluginCatalog.pluginsQuery.isError,
        errorMessage: pluginCatalog.pluginsQuery.error?.message || '',
        pluginCatalogQuery: pluginCatalog.pluginCatalogQuery,
        setPluginCatalogQuery: pluginCatalog.setPluginCatalogQuery,
        pluginCatalogSort: pluginCatalog.pluginCatalogSort,
        setPluginCatalogSort: pluginCatalog.setPluginCatalogSort,
        filteredSupportedPlugins: pluginCatalog.filteredSupportedPlugins,
        expandedPluginId: pluginCatalog.expandedPluginId,
        setExpandedPluginId: pluginCatalog.setExpandedPluginId
      })}
    </SectionSuspense>
  );
}

export function renderThemeCatalogSection({
  activeSection,
  AdminSupportedThemesSection: SupportedThemesSection,
  themeCatalog
}) {
  if (activeSection !== 'themes') {
    return null;
  }

  return (
    <SectionSuspense label="Loading supported themes...">
      {createElement(SupportedThemesSection, {
        totalThemes: themeCatalog.managedThemes.length,
        isLoading: themeCatalog.themesQuery.isLoading,
        isError: themeCatalog.themesQuery.isError,
        errorMessage: themeCatalog.themesQuery.error?.message || '',
        themeCatalogQuery: themeCatalog.themeCatalogQuery,
        setThemeCatalogQuery: themeCatalog.setThemeCatalogQuery,
        themeCatalogSort: themeCatalog.themeCatalogSort,
        setThemeCatalogSort: themeCatalog.setThemeCatalogSort,
        filteredSupportedThemes: themeCatalog.filteredSupportedThemes,
        expandedThemeId: themeCatalog.expandedThemeId,
        setExpandedThemeId: themeCatalog.setExpandedThemeId
      })}
    </SectionSuspense>
  );
}

export function renderThemeManagerSection({
  activeSection,
  AdminThemeManagerSection: ThemeManagerSection,
  themeManager
}) {
  if (activeSection !== 'theme-manager') {
    return null;
  }

  return (
    <SectionSuspense label="Loading theme manager...">
      {createElement(ThemeManagerSection, {
        sortThemesMutation: themeManager.sortThemesMutation,
        themesQuery: themeManager.themesQuery,
        managedThemes: themeManager.managedThemes,
        themeDraft: themeManager.themeDraft,
        setThemeDraft: themeManager.setThemeDraft,
        editingThemeId: themeManager.editingThemeId,
        createThemePending: themeManager.createThemeMutation.isPending,
        updateThemePending: themeManager.updateThemeMutation.isPending,
        onThemeSave: themeManager.handleThemeSave,
        onThemeReset: themeManager.cancelThemeEdit,
        themeValidationError: themeManager.themeValidationError,
        themeSaveError: themeManager.createThemeMutation.error?.message || themeManager.updateThemeMutation.error?.message || '',
        onOpenCreateModal: themeManager.handleOpenCreateThemeModal,
        showCreateModal: themeManager.showCreateThemeModal,
        onCloseCreateModal: themeManager.handleCloseCreateThemeModal,
        startEditingTheme: themeManager.startEditingTheme,
        deleteThemeMutation: themeManager.deleteThemeMutation
      })}
    </SectionSuspense>
  );
}
