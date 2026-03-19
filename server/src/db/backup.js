import { copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { getDb } from './client.js';

async function main() {
  const db = await getDb();
  if (db.__meta?.isRemote !== false) {
    throw new Error('Local backup is not supported for Turso remote databases. Use Turso backup tooling instead.');
  }

  const sourcePath = db.__meta?.url?.replace(/^file:/, '');
  if (!sourcePath) {
    throw new Error('Unable to determine local database file path');
  }
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
