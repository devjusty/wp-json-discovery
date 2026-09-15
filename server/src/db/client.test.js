import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createClient } from '@libsql/client';
import { afterEach, describe, expect, it } from '@jest/globals';

const temporaryPaths = [];

afterEach(async () => {
  await Promise.all(temporaryPaths.splice(0).map((dbPath) => fs.rm(dbPath, { force: true, recursive: true })));
});

describe('database migrations', () => {
  it('repairs a database marked at version 7 without investigation tables', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'wpjd-db-'));
    const dbPath = path.join(directory, 'test.sqlite');
    temporaryPaths.push(directory);

    const setupClient = createClient({ url: `file:${dbPath}` });
    await setupClient.batch([
      {
        sql: `create table app_meta (key text primary key, value text not null)`,
      },
      {
        sql: `insert into app_meta (key, value) values ('schema_version', '7')`,
      },
    ], 'write');
    setupClient.close();

    process.env.NODE_ENV = 'test';
    process.env.TURSO_DATABASE_URL = `file:${dbPath}`;
    const { getDb } = await import(`./client.js?migration-test=${Date.now()}`);

    const db = await getDb();
    const tables = await db.execute(
      `select name from sqlite_master where type = 'table' and name in ('investigations', 'investigation_sessions', 'investigation_claims') order by name`
    );

    expect(tables.rows.map(({ name }) => name)).toEqual([
      'investigation_claims',
      'investigation_sessions',
      'investigations',
    ]);
  });
});
