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

export async function fetchPlugins() {
  const result = await request('/api/admin/plugins');
  if (!result.ok) {
    throw new Error('Unable to load plugins');
  }
  return result.data;
}

export async function createPlugin(payload) {
  const result = await request('/api/admin/plugins', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
  if (!result.ok) {
    throw new Error(result.data?.error ?? 'Failed to create plugin');
  }
  return result.data;
}

export async function updatePlugin(id, payload) {
  const result = await request(`/api/admin/plugins/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  });
  if (!result.ok) {
    throw new Error(result.data?.error ?? 'Failed to update plugin');
  }
  return result.data;
}

export async function deletePlugin(id) {
  const result = await request(`/api/admin/plugins/${encodeURIComponent(id)}`, {
    method: 'DELETE'
  });
  if (!result.ok) {
    throw new Error(result.data?.error ?? 'Failed to delete plugin');
  }
  return result.data;
}

export async function sortPlugins() {
  const result = await request('/api/admin/plugins/sort', {
    method: 'POST'
  });
  if (!result.ok) {
    throw new Error(result.data?.error ?? 'Failed to sort plugins');
  }
  return result.data;
}

export async function fetchThemes() {
  const result = await request('/api/admin/themes');
  if (!result.ok) {
    throw new Error('Unable to load themes');
  }
  return result.data;
}

export async function createTheme(payload) {
  const result = await request('/api/admin/themes', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
  if (!result.ok) {
    throw new Error(result.data?.error ?? 'Failed to create theme');
  }
  return result.data;
}

export async function updateTheme(id, payload) {
  const result = await request(`/api/admin/themes/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  });
  if (!result.ok) {
    throw new Error(result.data?.error ?? 'Failed to update theme');
  }
  return result.data;
}

export async function deleteTheme(id) {
  const result = await request(`/api/admin/themes/${encodeURIComponent(id)}`, {
    method: 'DELETE'
  });
  if (!result.ok) {
    throw new Error(result.data?.error ?? 'Failed to delete theme');
  }
  return result.data;
}

export async function sortThemes() {
  const result = await request('/api/admin/themes/sort', {
    method: 'POST'
  });
  if (!result.ok) {
    throw new Error(result.data?.error ?? 'Failed to sort themes');
  }
  return result.data;
}
