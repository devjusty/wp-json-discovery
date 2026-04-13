import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
  activeSection
}) {
  const queryClient = useQueryClient();

  // Invalidate keys instead of chaining refetches to let React Query dedupe requests.
  const invalidateSnapshot = () => queryClient.invalidateQueries({ queryKey: ['dbSnapshot'] });
  const invalidatePlugins = () => queryClient.invalidateQueries({ queryKey: ['adminPlugins'] });
  const invalidateThemes = () => queryClient.invalidateQueries({ queryKey: ['adminThemes'] });

  const snapshotQuery = useQuery({
    queryKey: ['dbSnapshot'],
    queryFn: () => fetchDbSnapshot(75),
    refetchOnWindowFocus: false
  });

  const pruneMutation = useMutation({
    mutationFn: pruneActivityLogs,
    onSuccess: () => {
      invalidateSnapshot();
    }
  });

  const maintenanceMutation = useMutation({
    mutationFn: runDbMaintenance,
    onSuccess: () => {
      invalidateSnapshot();
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
    onSuccess: async () => {
      await Promise.all([invalidatePlugins(), invalidateSnapshot()]);
    }
  });

  const updatePluginMutation = useMutation({
    mutationFn: ({ id, payload }) => updatePlugin(id, payload),
    onSuccess: async () => {
      await Promise.all([invalidatePlugins(), invalidateSnapshot()]);
    }
  });

  const deletePluginMutation = useMutation({
    mutationFn: deletePlugin,
    onSuccess: async () => {
      await Promise.all([invalidatePlugins(), invalidateSnapshot()]);
    }
  });

  const sortPluginsMutation = useMutation({
    mutationFn: sortPluginsApi,
    onSuccess: async () => {
      await Promise.all([invalidatePlugins(), invalidateSnapshot()]);
    }
  });

  const createThemeMutation = useMutation({
    mutationFn: createTheme,
    onSuccess: async () => {
      await invalidateThemes();
    }
  });

  const updateThemeMutation = useMutation({
    mutationFn: ({ id, payload }) => updateTheme(id, payload),
    onSuccess: async () => {
      await invalidateThemes();
    }
  });

  const deleteThemeMutation = useMutation({
    mutationFn: deleteTheme,
    onSuccess: async () => {
      await invalidateThemes();
    }
  });

  const sortThemesMutation = useMutation({
    mutationFn: sortThemesApi,
    onSuccess: () => {
      invalidateThemes();
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
