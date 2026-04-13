export function normalizeDomain(input = '') {
  return input
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/+$/, '')
    .replace(/^www\./i, '')
    .toLowerCase();
}

function stripHtml(value) {
  if (!value || typeof value !== 'string') {
    return '';
  }

  return value.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

export function decodeHtml(value) {
  if (typeof value !== 'string') {
    return '';
  }

  if (typeof window === 'undefined') {
    return stripHtml(value);
  }

  const textarea = document.createElement('textarea');
  textarea.innerHTML = value;
  return stripHtml(textarea.value);
}

export function formatDate(value) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function formatDurationMs(durationMs) {
  if (!Number.isFinite(durationMs)) {
    return '—';
  }

  if (durationMs >= 1000) {
    return `${(durationMs / 1000).toFixed(1)}s`;
  }

  return `${durationMs}ms`;
}

export function toCsvFilename(domain, key) {
  const safeDomain = domain.replace(/[^a-z0-9.-]/gi, '-');
  const safeKey = key.replace(/[^a-z0-9.-]/gi, '-');
  return `${safeDomain}-${safeKey}.csv`;
}

export function extractErrorMessage(payload) {
  if (!payload) {
    return 'No additional details provided';
  }

  if (typeof payload === 'string') {
    return payload;
  }

  if (payload.message) {
    return payload.message;
  }

  if (payload.code) {
    return payload.code;
  }

  return JSON.stringify(payload);
}
