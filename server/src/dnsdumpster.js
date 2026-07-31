import { AppError, NetworkError } from './utils/errors.js';
import { REQUEST_TIMEOUT_MS } from './config.js';

const DNSDUMPSTER_API_BASE = 'https://api.dnsdumpster.com/domain';

function getApiKey() {
  const key = process.env.DNS_DUMPSTER_API_KEY;
  if (typeof key !== 'string' || key.trim().length === 0) {
    return null;
  }
  return key.trim();
}

function asRecordArray(value) {
  return Array.isArray(value) ? value : [];
}

function asStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item) => typeof item === 'string');
}

/**
 * Fetch passive DNS / attack-surface records from DNS Dumpster for a domain.
 * @param {string} domain Sanitized hostname
 * @returns {Promise<object>} Normalized DNS Dumpster payload
 */
export async function fetchDnsDumpsterDomain(domain) {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new AppError('DNS Dumpster API key is not configured', 503);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const startedAt = Date.now();
  const targetUrl = `${DNSDUMPSTER_API_BASE}/${encodeURIComponent(domain)}`;

  try {
    const response = await fetch(targetUrl, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        accept: 'application/json',
        'X-API-Key': apiKey
      }
    });

    const contentType = response.headers.get('content-type') ?? '';
    let body = null;
    if (contentType.includes('application/json')) {
      try {
        body = await response.json();
      } catch {
        body = null;
      }
    } else {
      body = await response.text().catch(() => null);
    }

    if (response.status === 429) {
      const message = typeof body?.error === 'string'
        ? body.error
        : 'DNS Dumpster rate limit exceeded';
      throw new AppError(message, 429);
    }

    if (!response.ok) {
      const message = typeof body?.error === 'string'
        ? body.error
        : `DNS Dumpster request failed (${response.status})`;
      throw new NetworkError(message, 502);
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new NetworkError('DNS Dumpster returned an invalid response', 502);
    }

    const durationMs = Date.now() - startedAt;
    return {
      domain,
      startedAt: new Date(startedAt).toISOString(),
      completedAt: new Date(startedAt + durationMs).toISOString(),
      durationMs,
      totalARecs: Number.isFinite(body.total_a_recs) ? body.total_a_recs : asRecordArray(body.a).length,
      a: asRecordArray(body.a),
      cname: asRecordArray(body.cname),
      mx: asRecordArray(body.mx),
      ns: asRecordArray(body.ns),
      txt: asStringArray(body.txt)
    };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    if (error?.name === 'AbortError') {
      throw new NetworkError('DNS Dumpster request timed out', 504);
    }
    throw new NetworkError(`Failed to reach DNS Dumpster: ${error.message}`, 502);
  } finally {
    clearTimeout(timeout);
  }
}
