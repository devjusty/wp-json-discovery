import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { scanDomain } from '../services/scan.js';
import { upsertUnsupportedPlugin } from '../api/client.js';
import { logEvent, rotateActivityLog } from '../services/logger.js';

export function useScan() {
  const queryClient = useQueryClient();
  const [result, setResult] = useState(null);
  const [activeDomain, setActiveDomain] = useState('');

  const scanMutation = useMutation({
    mutationFn: scanDomain,
    onSuccess: async (data) => {
      setResult(data);
      let persistenceReport = [];

      if (data.plugins.unsupportedNamespaces.length > 0) {
        const persistenceOutcomes = await Promise.allSettled(
          data.plugins.unsupportedNamespaces.map((namespace) =>
            upsertUnsupportedPlugin({
              namespace,
              domain: data.domain
            })
          )
        );

        persistenceReport = persistenceOutcomes.map((outcome, index) => {
          const namespace = data.plugins.unsupportedNamespaces[index];
          if (outcome.status === 'fulfilled') {
            return {
              namespace,
              status: 'fulfilled'
            };
          }
          const message =
            outcome.reason?.message ??
            (typeof outcome.reason === 'string'
              ? outcome.reason
              : 'Unknown persistence error');

          toast.error(message);
          logEvent('unsupported.persist_failed', {
            domain: data.domain,
            namespace,
            message
          });

          return {
            namespace,
            status: 'rejected',
            message
          };
        });

        const hasSuccess = persistenceReport.some(
          (item) => item.status === 'fulfilled'
        );

        if (hasSuccess) {
          queryClient.invalidateQueries({ queryKey: ['unsupportedPlugins'] });
          queryClient.invalidateQueries({ queryKey: ['recentUserScans'] });
        }

        logEvent('unsupported.persist_attempt', {
          domain: data.domain,
          attempted: persistenceReport.length,
          fulfilled: persistenceReport.filter(
            (item) => item.status === 'fulfilled'
          ).length,
          rejected: persistenceReport.filter(
            (item) => item.status === 'rejected'
          ).length,
          details: persistenceReport.slice(0, 25)
        });
      }

      toast.success(`Scan complete for ${data.domain}`);
      logEvent('scan.complete', {
        domain: data.domain,
        metrics: data.metrics,
        coreSummary: data.core.map((dataset) => ({
          key: dataset.key,
          status: dataset.status,
          rows: dataset.rows.length,
          durationMs: dataset.durationMs
        })),
        matchedPlugins: data.plugins.matched.map((plugin) => ({
          id: plugin.plugin.id,
          namespaces: plugin.namespaces,
          routes: plugin.routes.length
        })),
        unsupportedNamespaces: data.plugins.unsupportedNamespaces.slice(0, 50),
        unsupportedPersistence: persistenceReport.slice(0, 50),
        snapshotBytes: JSON.stringify(data).length
      });
    },
    onError: (error) => {
      const friendlyMessage =
        error?.code === 'auth_required'
          ? 'Authentication required: REST API access is restricted on this site.'
          : error?.message || 'Scan failed';

      toast.error(friendlyMessage);
      logEvent('scan.error', {
        domain: activeDomain,
        message: friendlyMessage,
        code: error?.code,
        status: error?.status,
        details: error?.details,
        stack: error.stack
      });
    }
  });

  const rotateLogsMutation = useMutation({
    mutationFn: rotateActivityLog,
    onSuccess: (data) => {
      toast.success('Activity log rotated.');
      logEvent('logs.rotation_triggered', {
        filename: data?.filename ?? 'unknown',
        triggeredAt: new Date().toISOString()
      });
    },
    onError: (error) => {
      const message = error?.message ?? 'Failed to rotate logs.';
      toast.error(message);
      logEvent('logs.rotation_failed', { message });
    }
  });

  const startScan = (domain) => {
    setActiveDomain(domain);
    setResult(null); // Clear previous results on new scan
    logEvent('scan.started', { domain, triggeredAt: new Date().toISOString() });
    scanMutation.mutate(domain);
  };

  const rotateLogs = () => {
    rotateLogsMutation.mutate();
  };

  return {
    startScan,
    scanResult: result,
    isScanning: scanMutation.isPending,
    scanError: scanMutation.error,
    activeDomain,
    isRotatingLogs: rotateLogsMutation.isPending,
    rotateLogs
  };
}
