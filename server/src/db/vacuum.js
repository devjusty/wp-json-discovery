import { getDb } from './client.js';

async function main() {
  const db = await getDb();
  db.exec('vacuum;');
  console.log('Vacuum completed for', db.name);
}

main().catch((error) => {
  console.error('[db:vacuum] failed:', error);
  process.exit(1);
});
