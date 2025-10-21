import { appendFile, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.join(__dirname, '..', 'data');
const logFilePath = path.join(dataDir, 'activity.log');

async function ensureLogFile() {
  try {
    await stat(dataDir);
  } catch {
    await mkdir(dataDir, { recursive: true });
  }

  try {
    await stat(logFilePath);
  } catch {
    await appendFile(logFilePath, '', 'utf-8');
  }
}

export async function recordLog(type, payload = {}) {
  if (!type || typeof type !== 'string') {
    throw new Error('Log type must be a non-empty string');
  }

  await ensureLogFile();

  const entry = {
    timestamp: new Date().toISOString(),
    type,
    payload
  };

  const serialized = JSON.stringify(entry);
  await appendFile(logFilePath, `${serialized}\n`, 'utf-8');

  if (process.env.NODE_ENV !== 'test') {
    console.log('[log]', serialized);
  }
}

export function logSilently(type, payload = {}) {
  recordLog(type, payload).catch((error) => {
    console.error('[log:error]', error.message);
  });
}
