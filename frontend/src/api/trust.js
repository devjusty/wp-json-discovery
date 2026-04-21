import { request } from './client.js';

export async function fetchDomainTrust(domain) {
  const result = await request(`/api/admin/trust/domains/${encodeURIComponent(domain)}`);
  if (!result.ok) {
    throw new Error(result.data?.error ?? 'Failed to load domain trust');
  }
  return result.data;
}

export async function createTrustEnvelope(payload) {
  const result = await request('/api/admin/trust/envelopes', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if (!result.ok) {
    throw new Error(result.data?.error ?? 'Failed to persist trust envelope');
  }

  return result.data;
}

export async function evaluateTrustEnvelope(payload) {
  const result = await request('/api/admin/trust/evaluate', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if (!result.ok) {
    throw new Error(result.data?.error ?? 'Failed to evaluate trust warnings');
  }

  return result.data;
}

export async function setWarningStatus(id, status) {
  const result = await request(`/api/admin/trust/warnings/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  });

  if (!result.ok) {
    throw new Error(result.data?.error ?? 'Failed to update warning status');
  }

  return result.data;
}

export async function createDeepAuditJob(payload) {
  const result = await request('/api/deep-audit/jobs', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if (!result.ok) {
    throw new Error(result.data?.error ?? 'Failed to queue deep audit job');
  }

  return result.data;
}

export async function fetchDeepAuditJob(jobId) {
  const result = await request(`/api/deep-audit/jobs/${encodeURIComponent(jobId)}`);
  if (!result.ok) {
    throw new Error(result.data?.error ?? 'Failed to load deep audit job');
  }
  return result.data;
}
