import { useMutation, useQuery } from '@tanstack/react-query';
import {
  fetchDbSnapshot,
  pruneActivityLogs,
  runDbMaintenance,
  fetchPlugins,
  fetchThemes,
  createPlugin,
  updatePlugin,
  deletePlugin,
  sortPlugins as sortPluginsApi,
  createTheme,
  updateTheme,
  deleteTheme,
  sortThemes as sortThemesApi
} from '../../../api/admin.js';
import { fetchScanHistory } from '../../../api/client.js';

export default function useAdminQueries({
  activeSection,
  onPluginCreated,
  onPluginSaved,
  onThemeCreated,
  onThemeSaved
}) {
  const snapshotQuery = useQuery({
    queryKey: ['dbSnapshot'],
    queryFn: () => fetchDbSnapshot(75),
    refetchOnWindowFocus: false
  });

  const pruneMutation = useMutation({
    mutationFn: pruneActivityLogs,
    onSuccess: () => {
      snapshotQuery.refetch();
    }
  });

  const maintenanceMutation = useMutation({
    mutationFn: runDbMaintenance,
    onSuccess: () => {
      snapshotQuery.refetch();
    }
  });

  const pluginsQuery = useQuery({
    queryKey: ['adminPlugins'],
    queryFn: fetchPlugins,
    enabled: activeSection === 'plugin-manager' || activeSection === 'plugins',
    refetchOnWindowFocus: false
  });

  const themesQuery = useQuery({
    queryKey: ['adminThemes'],
    queryFn: fetchThemes,
    enabled: activeSection === 'themes' || activeSection === 'theme-manager',
    refetchOnWindowFocus: false
  });

  const domainsHistoryQuery = useQuery({
    queryKey: ['adminDomainsHistory'],
    queryFn: () => fetchScanHistory({
      includeFailed: true,
      sort: 'recent',
      limit: 200,
      offset: 0
    }),
    enabled: activeSection === 'domains',
    refetchOnWindowFocus: false
  });

  const createPluginMutation = useMutation({
    mutationFn: createPlugin,
    onSuccess: () => {
      pluginsQuery.refetch();
      snapshotQuery.refetch();
      onPluginCreated?.();
    }
  });

  const updatePluginMutation = useMutation({
    mutationFn: ({ id, payload }) => updatePlugin(id, payload),
    onSuccess: () => {
      pluginsQuery.refetch();
      snapshotQuery.refetch();
      onPluginSaved?.();
    }
  });

  const deletePluginMutation = useMutation({
    mutationFn: deletePlugin,
    onSuccess: () => {
      pluginsQuery.refetch();
      snapshotQuery.refetch();
      onPluginSaved?.();
    }
  });

  const sortPluginsMutation = useMutation({
    mutationFn: sortPluginsApi,
    onSuccess: () => {
      pluginsQuery.refetch();
      snapshotQuery.refetch();
    }
  });

  const createThemeMutation = useMutation({
    mutationFn: createTheme,
    onSuccess: () => {
      themesQuery.refetch();
      onThemeCreated?.();
    }
  });

  const updateThemeMutation = useMutation({
    mutationFn: ({ id, payload }) => updateTheme(id, payload),
    onSuccess: () => {
      themesQuery.refetch();
      onThemeSaved?.();
    }
  });

  const deleteThemeMutation = useMutation({
    mutationFn: deleteTheme,
    onSuccess: () => {
      themesQuery.refetch();
      onThemeSaved?.();
    }
  });

  const sortThemesMutation = useMutation({
    mutationFn: sortThemesApi,
    onSuccess: () => {
      themesQuery.refetch();
    }
  });

  return {
    snapshotQuery,
    pruneMutation,
    maintenanceMutation,
    pluginsQuery,
    themesQuery,
    domainsHistoryQuery,
    createPluginMutation,
    updatePluginMutation,
    deletePluginMutation,
    sortPluginsMutation,
    createThemeMutation,
    updateThemeMutation,
    deleteThemeMutation,
    sortThemesMutation
  };
}
