export function evaluateConsistency({ envelopeId, domain, findings = {}, catalog = {}, history = {} }) {
  const warnings = [];
  const findingNamespaces = new Set(normalizeStringArray(findings.namespaces));
  const catalogNamespaces = new Set(normalizeStringArray(catalog.namespaces));

  for (const namespace of findingNamespaces) {
    if (!catalogNamespaces.has(namespace)) {
      warnings.push(createWarning({
        envelopeId,
        ruleCode: 'SCAN_CATALOG_MISMATCH',
        severity: 'warn',
        entityRef: { domain, namespace },
        reason: `Namespace ${namespace} not represented in catalog`,
        remediationHint: 'Add or map the plugin/theme in Catalog and rerun scan.',
      }));
    }
  }

  const historyNamespaces = new Set(normalizeStringArray(history.namespaces));
  for (const namespace of findingNamespaces) {
    if (historyNamespaces.size > 0 && !historyNamespaces.has(namespace)) {
      warnings.push(createWarning({
        envelopeId,
        ruleCode: 'SCAN_HISTORY_DRIFT',
        severity: 'info',
        entityRef: { domain, namespace },
        reason: `Namespace ${namespace} differs from recent history`,
        remediationHint: 'Re-run scan to confirm drift or reconcile expected plugin changes.',
      }));
    }
  }

  return warnings;
}

function createWarning({ envelopeId, ruleCode, severity, entityRef, reason, remediationHint }) {
  return {
    envelopeId,
    ruleCode,
    severity,
    status: 'open',
    entityRef,
    reason,
    remediationHint,
    emittedAt: new Date().toISOString(),
  };
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter(Boolean);
}
