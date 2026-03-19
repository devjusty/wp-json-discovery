import { getDb } from './client.js';

async function main() {
  const db = await getDb();
  if (db.__meta?.isRemote !== false) {
    console.log('Vacuum is not applicable for Turso remote databases.');
    return;
  }

  await db.execute('vacuum');
  console.log('Vacuum completed for', db.__meta?.url ?? 'local database');
}

main().catch((error) => {
  console.error('[db:vacuum] failed:', error);
  process.exit(1);
});
