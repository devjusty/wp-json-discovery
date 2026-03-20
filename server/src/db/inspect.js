import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDb, queryOne } from './client.js';
import { loadEnvFile } from '../utils/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

loadEnvFile(path.join(__dirname, '..', '..', '.env'));

async function main() {
  const tables = [
    { name: 'unsupported_plugins', query: 'select count(1) as count from unsupported_plugins' },
    { name: 'unsupported_plugin_domains', query: 'select count(1) as count from unsupported_plugin_domains' },
    { name: 'activity_logs', query: 'select count(1) as count from activity_logs' }
  ];

  const results = await Promise.all(tables.map(async ({ name, query }) => {
    try {
      const row = await queryOne(query);
      const count = Number(row?.count ?? 0);
      return { name, count };
    } catch (error) {
      return { name, error: error.message };
    }
  }));

  const db = await getDb();
  const lastLog = await queryOne('select timestamp, type from activity_logs order by id desc limit 1');

  console.log('Database:', db.__meta?.url ?? process.env.TURSO_DATABASE_URL ?? 'unknown');
  results.forEach((row) => {
    if (row.error) {
      console.log(`- ${row.name}: error (${row.error})`);
    } else {
      console.log(`- ${row.name}: ${row.count}`);
    }
  });

  if (lastLog) {
    console.log('Last log:', `${lastLog.timestamp} [${lastLog.type}]`);
  } else {
    console.log('Last log: none');
  }
}

main().catch((error) => {
  console.error('[db:inspect] failed:', error);
  process.exit(1);
});
