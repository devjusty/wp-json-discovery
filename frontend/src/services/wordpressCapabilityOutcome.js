export async function onWordpressSettled(state, session, ports) {
  if (state?.status === 'success') {
    await reportSuccess(state.result, session, ports);
    return;
  }

  if (['failed', 'unavailable'].includes(state?.status)) {
    reportFailure(state.error, session, ports);
  }
}

async function reportSuccess(data, session, ports) {
  const {
    isAuthenticated,
    upsertUnsupportedPlugin,
    invalidateQueries,
    logEvent,
    isActive = () => true
  } = ports;
  const unsupportedNamespaces = data?.plugins?.unsupportedNamespaces ?? [];
  let persistenceReport = [];

  if (isAuthenticated && unsupportedNamespaces.length > 0) {
    const persistenceOutcomes = await Promise.allSettled(
      unsupportedNamespaces.map((namespace) => upsertUnsupportedPlugin({
        namespace,
        domain: data.domain
      }))
    );

    if (!isActive()) {
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
      ports.toastError?.(message);
      logEvent('unsupported.persist_failed', { domain: data.domain, namespace, message });
      return { namespace, status: 'rejected', message };
    });

    if (persistenceReport.some((item) => item.status === 'fulfilled')) {
      invalidateQueries({ queryKey: ['unsupportedPlugins'] });
      invalidateQueries({ queryKey: ['recentUserScans'] });
    }
    logEvent('unsupported.persist_attempt', {
      domain: data.domain,
      attempted: persistenceReport.length,
      fulfilled: persistenceReport.filter((item) => item.status === 'fulfilled').length,
      rejected: persistenceReport.filter((item) => item.status === 'rejected').length,
      details: persistenceReport.slice(0, 25)
    });
  }

  if (!isActive()) {
    return;
  }

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
}

function reportFailure(error, session, ports) {
  const friendlyMessage = error?.code === 'auth_required'
    ? 'Authentication required: REST API access is restricted on this site.'
    : error?.message || 'Scan failed';
  ports.logEvent('scan.error', {
    domain: session.domain,
    message: friendlyMessage,
    code: error?.code,
    status: error?.status,
    details: error?.details,
    stack: error?.stack
  });
}
