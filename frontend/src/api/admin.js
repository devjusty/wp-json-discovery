import { request } from './client.js';

export async function fetchDbSnapshot(limit = 50) {
  const result = await request(`/api/admin/db-snapshot?limit=${limit}`);

  if (!result.ok) {
    throw new Error('Unable to load DB snapshot');
  }

  return result.data;
}
