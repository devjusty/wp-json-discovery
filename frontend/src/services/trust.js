const BLOCKING_SEVERITY = 'blocking';

export function mapTrustSnapshot(snapshot = {}) {
  const envelope = snapshot.envelope ?? null;
  const warnings = Array.isArray(snapshot.warnings) ? snapshot.warnings : [];
  const unresolved = warnings.filter((warning) => warning.status === 'open');
  const hasBlocking = unresolved.some((warning) => warning.severity === BLOCKING_SEVERITY);
  const hasEnvelope = Boolean(envelope?.envelopeId);

  return {
    status: !hasEnvelope
      ? 'unknown'
      : hasBlocking
        ? 'blocked'
        : unresolved.length > 0
          ? 'warning'
          : 'pass',
    unresolvedCount: unresolved.length,
    warnings,
    envelope,
    domain: snapshot.domain ?? null,
  };
}
