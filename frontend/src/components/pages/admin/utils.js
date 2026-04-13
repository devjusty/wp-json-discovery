export function serializePayload(payload) {
  if (typeof payload === 'string') return payload;
  return JSON.stringify(payload ?? {}, null, 2);
}

export function getPayloadSize(text) {
  if (!text) return 0;
  try {
    return new Blob([text]).size;
  } catch {
    return text.length;
  }
}

export function truncateText(text, maxLength) {
  if (!text || text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}…`;
}

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, index);
  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

export function formatMs(value) {
  if (!Number.isFinite(value)) return '—';
  return `${Math.round(value)}ms`;
}

export function formatShortDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', {
    timeZone: 'America/New_York',
    month: '2-digit',
    day: '2-digit',
    year: '2-digit'
  });
}

export function formatFullTimestamp(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

export function formatCompactTimestamp(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function formatWalSummary(walCheckpoint) {
  if (!walCheckpoint) return 'Not run';
  if (walCheckpoint.error) return `Error: ${walCheckpoint.error}`;
  const logPages = walCheckpoint.log ?? walCheckpoint.log_pages ?? walCheckpoint.logFrames ?? walCheckpoint.log_frames;
  const checkpointed = walCheckpoint.checkpointed ?? walCheckpoint.checkpointedFrames ?? walCheckpoint.frames;
  const busy = walCheckpoint.busy ?? walCheckpoint.blocked;
  return [
    Number.isFinite(logPages) ? `${logPages} log pages` : null,
    Number.isFinite(checkpointed) ? `${checkpointed} checkpointed` : null,
    Number.isFinite(busy) ? `${busy} busy` : null
  ]
    .filter(Boolean)
    .join(' · ') || 'Completed';
}

export function deriveHeartbeatSeries(recent = [], getValue) {
  if (!recent.length) return [];
  return [...recent]
    .sort((a, b) => {
      const left = Date.parse(a?.timestamp ?? '');
      const right = Date.parse(b?.timestamp ?? '');
      if (Number.isNaN(left) || Number.isNaN(right)) return 0;
      return left - right;
    })
    .map((entry) => getValue(entry.payload ?? {}))
    .filter((value) => Number.isFinite(value));
}

export function formatDelta(delta, formatValue) {
  return formatValue(Math.abs(delta));
}

export function buildSparkline(values) {
  if (!values.length) return '------';
  if (values.length === 1) return '●';

  const ticks = '▁▂▃▄▅▆▇█';
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) return values.map(() => '▅').join('');

  return values
    .map((value) => {
      const normalized = (value - min) / (max - min);
      const index = Math.max(0, Math.min(ticks.length - 1, Math.round(normalized * (ticks.length - 1))));
      return ticks[index];
    })
    .join('');
}
