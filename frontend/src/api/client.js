const DEFAULT_API_BASE_URL = 'http://localhost:4100';

const API_BASE_URL =
  typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL
    ? import.meta.env.VITE_API_BASE_URL
    : DEFAULT_API_BASE_URL;

export async function request(path, options = {}) {
  const url = `${API_BASE_URL}${path}`;

  try {
    const headers = new Headers(options.headers ?? {});
    if (options.body && !headers.has('content-type')) {
      headers.set('content-type', 'application/json');
    }
    headers.set('accept', 'application/json, text/plain, */*');

    const response = await fetch(url, {
      ...options,
      headers
    });

    const contentType = response.headers.get('content-type') ?? '';
    const responseHeaders = Object.fromEntries(response.headers.entries());
    let data;

    if (contentType.includes('application/json')) {
      try {
        data = await response.json();
      } catch {
        data = await response.text();
      }
    } else {
      data = await response.text();
    }

    return {
      ok: response.ok,
      status: response.status,
      data,
      contentType,
      headers: responseHeaders
    };
  } catch (error) {
    throw new Error(`Failed to reach API at ${url}: ${error.message}`);
  }
}

export async function proxyRequest({ domain, endpoint }) {
  const searchParams = new URLSearchParams({
    domain,
    endpoint
  });

  return request(`/api/proxy?${searchParams.toString()}`);
}

export async function fetchUnsupportedPlugins() {
  const result = await request('/api/unsupported-plugins');

  if (!result.ok) {
    throw new Error('Unable to load unsupported plugins list');
  }

  return result.data;
}

export async function upsertUnsupportedPlugin(payload) {
  const result = await request('/api/unsupported-plugins', {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  if (!result.ok) {
    throw new Error(
      `Unable to persist unsupported plugin (${payload.namespace})`
    );
  }

  return result.data;
}

export async function runHomepageScan(payload) {
  const result = await request('/api/homepage-scan', {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  if (!result.ok) {
    const message =
      typeof result.data?.error === 'string'
        ? result.data.error
        : 'Homepage scan failed';
    throw new Error(message);
  }

  return result.data;
}

export async function runSitemapScan(payload) {
  const result = await request('/api/sitemap-scan', {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  if (!result.ok) {
    throw new Error('Sitemap scan failed');
  }

  return result.data;
}
