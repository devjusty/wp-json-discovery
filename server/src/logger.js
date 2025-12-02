import { appendFile, mkdir, rename, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDb } from './db/client.js';

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
  const filePromise = appendFile(logFilePath, `${serialized}\n`, 'utf-8');
  const dbPromise = writeToDb(entry);

  await Promise.allSettled([filePromise, dbPromise]);

  if (process.env.NODE_ENV !== 'test') {
    console.log('[log]', serialized);
  }
}

async function writeToDb(entry) {
  try {
    const db = await getDb();
    db.prepare(
      `
      insert into activity_logs (timestamp, type, payload_json)
      values (?, ?, ?)
    `
    ).run(entry.timestamp, entry.type, JSON.stringify(entry.payload ?? {}));
  } catch (error) {
    console.error('[log:db:error]', error.message);
  }
}

export function logSilently(type, payload = {}) {
  recordLog(type, payload).catch((error) => {
    console.error('[log:error]', error.message);
  });
}

export async function rotateLog() {
  await ensureLogFile();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const archiveName = `activity-${timestamp}.log`;
  const archivePath = path.join(dataDir, archiveName);

  await rename(logFilePath, archivePath);
  await appendFile(logFilePath, '', 'utf-8');

  let rowsCleared = 0;
  try {
    const db = await getDb();
    const result = db.prepare('delete from activity_logs').run();
    rowsCleared = result?.changes ?? 0;
  } catch (error) {
    console.error('[log:db:rotate_error]', error.message);
  }

  return {
    archivePath,
    archiveName,
    rowsCleared
  };
}
