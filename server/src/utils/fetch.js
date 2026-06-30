import { sanitizeDomain } from './domain.js';
import { assertHostResolvesToPublicAddresses } from './network.js';

export async function fetchWithRedirects(targetUrl, options = {}, maxRedirects = 3) {
  const { allowedHost, ...fetchOptions } = options;

  let currentUrl = targetUrl;
  let redirects = 0;
  const expectedHost = resolveExpectedHost(targetUrl, allowedHost);

  await assertHostResolvesToPublicAddresses(expectedHost, options);

  while (redirects <= maxRedirects) {
    const response = await fetch(currentUrl, {
      ...fetchOptions,
      redirect: 'manual'
    });

    const location = response.headers.get('location');
    const isRedirect = response.status >= 300 && response.status < 400 && location;

    if (!isRedirect) {
      return { response, finalUrl: currentUrl, redirects };
    }

    redirects += 1;
    const redirectedUrl = new URL(location, currentUrl);
    assertHostAllowed(redirectedUrl, expectedHost);
    await assertHostResolvesToPublicAddresses(redirectedUrl.hostname, options);
    currentUrl = redirectedUrl.toString();
  }

  // Return last response even if redirect limit exceeded
  const response = await fetch(currentUrl, {
    ...fetchOptions,
    redirect: 'manual'
  });
  return { response, finalUrl: currentUrl, redirects };
}

function resolveExpectedHost(targetUrl, allowedHost) {
  const explicitHost = normalizeHost(allowedHost);
  if (explicitHost) {
    return explicitHost;
  }

  try {
    const parsed = new URL(targetUrl);
    const normalized = normalizeHost(parsed.hostname);
    if (normalized) {
      return normalized;
    }
  } catch {
    // Ignore parse errors and fail with fallback below.
  }

  throw new Error('Invalid request host for redirect validation');
}

function assertHostAllowed(redirectedUrl, expectedHost) {
  const redirectedHost = normalizeHost(redirectedUrl.hostname);
  if (!redirectedHost) {
    throw new Error('Redirect target hostname is invalid');
  }

  if (!expectedHost || normalizeForComparison(redirectedHost) !== normalizeForComparison(expectedHost)) {
    throw new Error(`Redirect target host mismatch (${redirectedHost})`);
  }
}

function normalizeHost(hostname) {
  if (typeof hostname !== 'string' || hostname.trim().length === 0) {
    return null;
  }
  return sanitizeDomain(hostname) ?? null;
}

function normalizeForComparison(hostname) {
  return hostname.replace(/^www\./i, '').toLowerCase();
}
