import { getDb } from './client.js';

async function main() {
  const db = await getDb();
  const tables = [
    { name: 'unsupported_plugins', query: 'select count(1) as count from unsupported_plugins' },
    { name: 'unsupported_plugin_domains', query: 'select count(1) as count from unsupported_plugin_domains' },
    { name: 'activity_logs', query: 'select count(1) as count from activity_logs' }
  ];

  const results = tables.map(({ name, query }) => {
    try {
      const [{ count }] = db.prepare(query).all();
      return { name, count };
    } catch (error) {
      return { name, error: error.message };
    }
  });

  const lastLog = db
    .prepare('select timestamp, type from activity_logs order by id desc limit 1')
    .get();

  console.log('Database path:', db.name);
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
