function toTimestamp(value) {
  const time = new Date(value ?? '').getTime();
  return Number.isFinite(time) ? time : 0;
}

export function mergeRecentScans(recentRuns = [], savedScans = []) {
  const recentByDomain = new Map(recentRuns.map((run) => [run.domain, run]));
  const savedByDomain = new Map(savedScans.map((scan) => [scan.domain, scan]));
  const domains = new Set([...recentByDomain.keys(), ...savedByDomain.keys()]);

  return [...domains]
    .map((domain) => {
      const recentRun = recentByDomain.get(domain) ?? null;
      const savedScan = savedByDomain.get(domain) ?? null;

      return {
        domain,
        isSaved: Boolean(savedScan),
        savedAt: savedScan?.saved_at ?? null,
        notes: savedScan?.notes ?? null,
        lastScannedAt: recentRun?.lastScannedAt ?? null,
        lastStatus: recentRun?.lastStatus ?? null
      };
    })
    .sort((left, right) => {
      const rightTime = toTimestamp(right.lastScannedAt ?? right.savedAt);
      const leftTime = toTimestamp(left.lastScannedAt ?? left.savedAt);
      return rightTime - leftTime;
    });
}
