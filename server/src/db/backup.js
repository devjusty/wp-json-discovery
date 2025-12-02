import { copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { getDb } from './client.js';

async function main() {
  const db = await getDb();
  if (db.name === ':memory:') {
    throw new Error('Cannot back up an in-memory database');
  }

  const sourcePath = db.name;
  const dir = path.dirname(sourcePath);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const targetPath = path.join(dir, `wpjd-backup-${timestamp}.sqlite`);

  await mkdir(dir, { recursive: true });
  await copyFile(sourcePath, targetPath);
  console.log(`Backup written to ${targetPath}`);
}

main().catch((error) => {
  console.error('[db:backup] failed:', error.message);
  process.exit(1);
});
