import {
  apiEnvelopeSchema,
  investigationListSchema,
  investigationRecordSchema,
  sessionRecordSchema
} from '@wp-json-discovery/contracts';
import type {
  DomainIdentity,
  InvestigationList,
  InvestigationRecord,
  SessionRecord,
  StartInvestigationRequest
} from '@wp-json-discovery/contracts';

type TokenProvider = () => Promise<string | null | undefined> | string | null | undefined;
type AuthUser = { email?: string; name?: string } | null | undefined;
type AuthUserProvider = () => Promise<AuthUser> | AuthUser;
type RequestResult = {
  ok: boolean;
  status: number;
  // API payloads are validated by endpoint-specific callers where schemas exist.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
  contentType: string;
  headers: Record<string, string>;
};

let globalGetAccessToken: TokenProvider | null = null;
let globalAuthUser: AuthUserProvider | null = null;

export function setTokenProvider(fn: TokenProvider | null) {
  globalGetAccessToken = fn;
}

export function setAuthUserProvider(fn: AuthUserProvider | null) {
  globalAuthUser = fn;
}

const DEFAULT_API_BASE_URL = 'http://localhost:4100';

const API_BASE_URL =
  typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL
    ? import.meta.env.VITE_API_BASE_URL
    : DEFAULT_API_BASE_URL;

const ADMIN_API_KEY =
  typeof import.meta !== 'undefined' && import.meta.env?.VITE_ADMIN_API_KEY
    ? import.meta.env.VITE_ADMIN_API_KEY
    : '';

function shouldAttachAdminKey(path: string) {
  return path === '/api/logs'
    || path.startsWith('/api/logs/')
    || path.startsWith('/api/admin/')
    || path === '/api/recon-scan'
    || path.startsWith('/api/recon-scan/');
}

async function readResponseBody(response: Response, contentType: string): Promise<unknown> {
  if (contentType.includes('application/json')) {
    try {
      return await response.json();
    } catch {
      return response.text();
    }
  }

  return response.text();
}

export async function request(path: string, options: RequestInit = {}): Promise<RequestResult> {
  const url = `${API_BASE_URL}${path}`;

  try {
    const headers = new Headers(options.headers ?? {});
    if (options.body && !headers.has('content-type')) {
      headers.set('content-type', 'application/json');
    }
    headers.set('accept', 'application/json, text/plain, */*');

    if (ADMIN_API_KEY && shouldAttachAdminKey(path)) {
      headers.set('x-wpjd-admin-key', ADMIN_API_KEY);
    }

    if (globalGetAccessToken && (
      path.startsWith('/api/user/') ||
      path.startsWith('/api/admin/') ||
      path === '/api/logs' ||
      path.startsWith('/api/logs/') ||
      path.startsWith('/api/scan-history') ||
      path === '/api/recon-scan' ||
      path.startsWith('/api/recon-scan/') ||
      path.startsWith('/api/unsupported-plugins')
      || path.startsWith('/api/investigations')
    )) {
      try {
        const token = await globalGetAccessToken();
        if (token) {
          headers.set('authorization', `Bearer ${token}`);
        }
      } catch {
        // Silently skip — user might not be logged in
      }

      if (globalAuthUser) {
        try {
          const userInfo = await globalAuthUser();
          if (userInfo?.email) {
            headers.set('x-user-email', userInfo.email);
          }
          if (userInfo?.name) {
            headers.set('x-user-name', userInfo.name);
          }
        } catch {
          // Silently skip
        }
      }
    }

    const response = await fetch(url, {
      ...options,
      headers
    });

    const contentType = response.headers.get('content-type') ?? '';
    const responseHeaders = Object.fromEntries(response.headers.entries());
    const ok = response.ok;
    const data = await readResponseBody(response, contentType);

    return {
      ok,
      status: response.status,
      data,
      contentType,
      headers: responseHeaders
    };
  } catch (error) {
    throw new Error(`Failed to reach API at ${url}: ${error.message}`);
  }
}

export async function proxyRequest({ domain, endpoint }: { domain: string; endpoint: string }) {
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

export async function upsertUnsupportedPlugin(payload: { namespace: string; [key: string]: unknown }) {
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

export async function runHomepageScan(payload: unknown) {
  const result = await request('/api/homepage-scan', {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  if (!result.ok) {
    const message =
      typeof (result.data as { error?: unknown })?.error === 'string'
        ? (result.data as { error: string }).error
        : 'Homepage scan failed';
    throw new Error(message);
  }

  return result.data;
}

export async function runSitemapScan(payload: unknown) {
  const result = await request('/api/sitemap-scan', {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  if (!result.ok) {
    throw new Error('Sitemap scan failed');
  }

  return result.data;
}

export async function runReconScan(payload: unknown) {
  const result = await request('/api/recon-scan', {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  if (!result.ok) {
    const message =
      typeof (result.data as { error?: unknown })?.error === 'string'
        ? (result.data as { error: string }).error
        : 'Domain recon scan failed';
    throw new Error(message);
  }

  return result.data;
}

export async function fetchScanHistory(options: {
  includeFailed?: boolean;
  q?: string;
  sort?: string;
  limit?: number;
  offset?: number;
} = {}) {
  const {
    includeFailed = false,
    q = '',
    sort = 'recent',
    limit = 50,
    offset = 0
  } = options;

  const params = new URLSearchParams();
  params.set('includeFailed', includeFailed ? 'true' : 'false');
  params.set('sort', sort);
  params.set('limit', String(limit));
  params.set('offset', String(offset));
  if (q) {
    params.set('q', q);
  }

  const result = await request(`/api/scan-history?${params.toString()}`);
  if (!result.ok) {
    throw new Error('Failed to load scan history');
  }

  return result.data;
}

export async function fetchDomainScanHistory(domain: string, options: { includeFailed?: boolean; limit?: number } = {}) {
  const { includeFailed = false, limit = 25 } = options;
  const params = new URLSearchParams({
    includeFailed: includeFailed ? 'true' : 'false',
    limit: String(limit)
  });

  const result = await request(
    `/api/scan-history/${encodeURIComponent(domain)}?${params.toString()}`
  );

  if (!result.ok) {
    throw new Error('Failed to load domain scan history');
  }

  return result.data;
}

export async function fetchPluginRegistry() {
  const result = await request('/api/registry/plugins');
  if (!result.ok) {
    throw new Error('Failed to load plugin registry');
  }
  return result.data;
}

export async function fetchUserProfile() {
  const result = await request('/api/user/me');
  if (!result.ok) {
    throw new Error('Failed to load user profile');
  }
  return result.data;
}

export async function fetchUserRecentRuns(limit = 8) {
  const result = await request(`/api/user/scans/recent-runs?limit=${limit}`);
  if (!result.ok) {
    throw new Error('Failed to load recent scan runs');
  }
  return result.data;
}

export async function clearUserRecentRuns() {
  const result = await request('/api/user/scans/recent-runs', {
    method: 'DELETE'
  });

  if (!result.ok) {
    throw new Error('Failed to clear recent scan runs');
  }

  return result.data;
}

export async function clearUserSavedScans() {
  const result = await request('/api/user/scans', {
    method: 'DELETE'
  });

  if (!result.ok) {
    throw new Error('Failed to clear saved scans');
  }

  return result.data;
}

export async function startInvestigation(
  domain: DomainIdentity,
  selectedCapabilities: StartInvestigationRequest['selectedCapabilities']
): Promise<InvestigationRecord> {
  return requestInvestigation('/api/investigations', {
    method: 'POST',
    body: JSON.stringify({ domain, selectedCapabilities })
  });
}

export async function fetchInvestigation(investigationId: string): Promise<InvestigationRecord> {
  return requestInvestigation(`/api/investigations/${encodeURIComponent(investigationId)}`);
}

/** @returns {Promise<import('@wp-json-discovery/contracts').InvestigationList>} */
export async function fetchInvestigations(): Promise<InvestigationList> {
  // Collection endpoint uses same envelope parser with different payload schema.
  return requestInvestigation('/api/investigations', undefined, investigationListSchema);
}

export async function saveInvestigationSession(
  investigationId: string,
  session: unknown
): Promise<SessionRecord> {
  return requestInvestigation(
    `/api/investigations/${encodeURIComponent(investigationId)}/sessions/${encodeURIComponent((session as { id: string }).id)}`,
    { method: 'POST', body: JSON.stringify({ session }) },
    sessionRecordSchema
  );
}

export async function claimAnonymousInvestigation(
  domain: DomainIdentity,
  anonymousRecord: unknown
): Promise<InvestigationRecord> {
  return requestInvestigation('/api/investigations/claim', {
    method: 'POST',
    body: JSON.stringify({ domain, anonymousRecord })
  });
}

async function requestInvestigation<T>(
  path: string,
  options?: RequestInit,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dataSchema: { safeParse: (data: unknown) => any } = investigationRecordSchema
): Promise<T> {
  const result = await request(path, options);
  const envelope = apiEnvelopeSchema.safeParse(result.data);

  if (!envelope.success) throw new Error('Invalid investigation response');
  if (!result.ok || envelope.data.status === 'error') {
    throw new Error(envelope.data.status === 'error'
      ? envelope.data.error.message
      : 'Investigation request failed');
  }
  if (envelope.data.status !== 'success') throw new Error('Investigation request incomplete');

  const record = dataSchema.safeParse(envelope.data.data);
  if (!record.success) throw new Error('Invalid investigation response');
  return record.data as T;
}
