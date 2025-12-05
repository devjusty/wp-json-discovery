import { request } from './client.js';

export async function fetchDbSnapshot(limit = 50) {
  const result = await request(`/api/admin/db-snapshot?limit=${limit}`);

  if (!result.ok) {
    throw new Error('Unable to load DB snapshot');
  }

  return result.data;
}

export async function pruneActivityLogs(payload = {}) {
  const result = await request('/api/admin/activity/prune', {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  if (!result.ok) {
    throw new Error('Failed to prune activity logs');
  }

  return result.data;
}

export async function runDbMaintenance() {
  const result = await request('/api/admin/db/maintenance', {
    method: 'POST'
  });

  if (!result.ok) {
    throw new Error('Failed to run DB maintenance');
  }

  return result.data;
}
