import { request } from '../api/client.js';

export async function logEvent(type, payload = {}) {
  try {
    const result = await request('/api/logs', {
      method: 'POST',
      body: JSON.stringify({
        type,
        payload
      })
    });

    if (!result.ok) {
      throw new Error(`Log request failed with status ${result.status}`);
    }
  } catch (error) {
    console.warn('[logger] Failed to record event', type, error.message);
  }
}

export async function rotateActivityLog() {
  const result = await request('/api/logs/rotate', {
    method: 'POST'
  });

  if (!result.ok) {
    const message =
      typeof result.data?.error === 'string'
        ? result.data.error
        : 'Failed to rotate activity log';
    throw new Error(message);
  }

  return result.data;
}
