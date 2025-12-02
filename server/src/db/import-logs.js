import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDb } from './client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultLogPath = path.join(__dirname, '..', 'data', 'activity.log');

async function main() {
  const logPath = process.argv[2] || defaultLogPath;
  const db = await getDb();
  const raw = await readFile(logPath, 'utf-8');
  const lines = raw.split('\n').map((line) => line.trim()).filter(Boolean);

  if (!lines.length) {
    console.log('No log lines found to import.');
    return;
  }

  const insert = db.prepare(
    'insert into activity_logs (timestamp, type, payload_json) values (?, ?, ?)'
  );

  let imported = 0;
  db.transaction(() => {
    lines.forEach((line) => {
      try {
        const parsed = JSON.parse(line);
        insert.run(parsed.timestamp ?? new Date().toISOString(), parsed.type ?? 'unknown', JSON.stringify(parsed.payload ?? {}));
        imported += 1;
      } catch (error) {
        console.warn('[db:import:logs] skip line', error.message);
      }
    });
  })();

  console.log(`Imported ${imported} log entries from ${logPath}`);
}

main().catch((error) => {
  console.error('[db:import:logs] failed:', error.message);
  process.exit(1);
});
