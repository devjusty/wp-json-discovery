import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth0 } from '@auth0/auth0-react';
import toast from 'react-hot-toast';
import { upsertUnsupportedPlugin } from '../api/client.js';
import { logEvent, rotateActivityLog } from '../services/logger.js';
import {
  getCapabilityById,
  getCapabilityDependencies,
  getCapabilityRunners,
  normalizeSelection
} from '../services/scanCapabilities.js';
import {
  createScanSession,
  executeScanSession,
  retryCapability as retrySessionCapability
} from '../services/scanSession.js';

export function useScan() {
  const { isAuthenticated } = useAuth0();
  const queryClient = useQueryClient();
  const [session, setSession] = useState(null);
  const sessionRef = useRef(null);
  const activeTokenRef = useRef(null);

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

  const isCurrent = (token) => token.active && activeTokenRef.current === token;
  const publishSession = (nextSession, token) => {
    if (!isCurrent(token)) {
      return;
    }
    sessionRef.current = nextSession;
    setSession(nextSession);
  };

  const reportWordpressSuccess = async (data, token) => {
    if (!isCurrent(token) || token.wordpressSuccessReported) {
      return;
    }
    token.wordpressSuccessReported = true;

    const unsupportedNamespaces = data?.plugins?.unsupportedNamespaces ?? [];
    let persistenceReport = [];
    if (isAuthenticated && unsupportedNamespaces.length > 0) {
      const persistenceOutcomes = await Promise.allSettled(
        unsupportedNamespaces.map((namespace) => upsertUnsupportedPlugin({
          namespace,
          domain: data.domain
        }))
      );
      if (!isCurrent(token)) {
        return;
      }

      persistenceReport = persistenceOutcomes.map((outcome, index) => {
        const namespace = unsupportedNamespaces[index];
        if (outcome.status === 'fulfilled') {
          return { namespace, status: 'fulfilled' };
        }

        const message = outcome.reason?.message ?? (
          typeof outcome.reason === 'string' ? outcome.reason : 'Unknown persistence error'
        );
        toast.error(message);
        logEvent('unsupported.persist_failed', { domain: data.domain, namespace, message });
        return { namespace, status: 'rejected', message };
      });

      if (persistenceReport.some((item) => item.status === 'fulfilled')) {
        queryClient.invalidateQueries({ queryKey: ['unsupportedPlugins'] });
        queryClient.invalidateQueries({ queryKey: ['recentUserScans'] });
      }
      logEvent('unsupported.persist_attempt', {
        domain: data.domain,
        attempted: persistenceReport.length,
        fulfilled: persistenceReport.filter((item) => item.status === 'fulfilled').length,
        rejected: persistenceReport.filter((item) => item.status === 'rejected').length,
        details: persistenceReport.slice(0, 25)
      });
    }

    if (!isCurrent(token)) {
      return;
    }
    toast.success(`Scan complete for ${data.domain}`);
    logEvent('scan.complete', {
      domain: data.domain,
      metrics: data.metrics,
      coreSummary: (data.core ?? []).map((dataset) => ({
        key: dataset.key,
        status: dataset.status,
        rows: dataset.rows.length,
        durationMs: dataset.durationMs
      })),
      matchedPlugins: (data.plugins?.matched ?? []).map((plugin) => ({
        id: plugin.plugin.id,
        namespaces: plugin.namespaces,
        routes: plugin.routes.length
      })),
      unsupportedNamespaces: unsupportedNamespaces.slice(0, 50),
      unsupportedPersistence: persistenceReport.slice(0, 50),
      snapshotBytes: JSON.stringify(data).length
    });
  };

  const reportWordpressError = (error, domain, token) => {
    if (!isCurrent(token) || token.wordpressErrorReported) {
      return;
    }
    token.wordpressErrorReported = true;
    const friendlyMessage = error?.code === 'auth_required'
      ? 'Authentication required: REST API access is restricted on this site.'
      : error?.message || 'Scan failed';
    toast.error(friendlyMessage);
    logEvent('scan.error', {
      domain,
      message: friendlyMessage,
      code: error?.code,
      status: error?.status,
      details: error?.details,
      stack: error?.stack
    });
  };

  const reportWordpressOutcome = async (nextSession, token) => {
    const wordpress = nextSession.capabilities.wordpress;
    if (wordpress?.status === 'success') {
      await reportWordpressSuccess(wordpress.result, token);
    }
    if (['failed', 'unavailable'].includes(wordpress?.status)) {
      reportWordpressError(wordpress.error, nextSession.domain, token);
    }
  };

  const execute = async (nextSession, capabilityIds, token) => {
    const completed = await executeScanSession(
      nextSession,
      getCapabilityRunners(capabilityIds),
      (changedSession) => publishSession(changedSession, token),
      token
    );
    if (!isCurrent(token)) {
      return completed;
    }
    publishSession(completed, token);
    await reportWordpressOutcome(completed, token);
    return completed;
  };

  const startScan = (domain, selection) => {
    if (activeTokenRef.current) {
      activeTokenRef.current.active = false;
    }
    const token = { active: true };
    activeTokenRef.current = token;
    const nextSession = createScanSession(domain, selection, getCapabilityDependencies());
    publishSession(nextSession, token);
    logEvent('scan.started', { domain, triggeredAt: new Date().toISOString() });
    return execute(nextSession, nextSession.selection.capabilityIds, token);
  };

  const runCapability = (id, options = {}) => {
    const current = sessionRef.current;
    const token = activeTokenRef.current;
    const capability = getCapabilityById(id);
    if (!current || !token || !isCurrent(token) || !capability?.availability() || current.selection.capabilityIds.includes(id)) {
      return Promise.resolve(current);
    }

    const selection = normalizeSelection({
      capabilityIds: [...current.selection.capabilityIds, id],
      options: {
        ...current.selection.options,
        [id]: { ...current.selection.options[id], ...options }
      }
    });
    const nextSession = createScanSession(current.domain, selection, getCapabilityDependencies());
    nextSession.capabilities = {
      ...nextSession.capabilities,
      ...current.capabilities
    };
    nextSession.overallStatus = 'running';
    publishSession(nextSession, token);
    return execute(nextSession, [id], token);
  };

  const retryCapability = async (id) => {
    const current = sessionRef.current;
    const token = activeTokenRef.current;
    if (!current || !token || !isCurrent(token)) {
      return current;
    }
    const completed = await retrySessionCapability(
      current,
      id,
      getCapabilityRunners([id]),
      (changedSession) => publishSession(changedSession, token),
      token
    );
    if (!isCurrent(token)) {
      return completed;
    }
    publishSession(completed, token);
    await reportWordpressOutcome(completed, token);
    return completed;
  };

  const rotateLogs = () => rotateLogsMutation.mutate();
  const wordpress = session?.capabilities.wordpress;

  return {
    session,
    startScan,
    runCapability,
    retryCapability,
    activeDomain: session?.domain ?? '',
    scanResult: wordpress?.result ?? null,
    isScanning: session?.overallStatus === 'running',
    scanError: wordpress?.error ?? null,
    isRotatingLogs: rotateLogsMutation.isPending,
    rotateLogs
  };
}
