import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import pg from 'pg';

const environment = await readFile(resolve('../../.env'), 'utf8');
const databaseUrl = environment.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
if (!databaseUrl) throw new Error('DATABASE_URL is missing.');
const pool = new pg.Pool({ connectionString: databaseUrl });
const connection = await pool.query('select current_database() as database, inet_server_port() as port');
const records = await pool.query(`
  select p.id, p.name, p.status, t.id as transcript_id,
         t.status as transcript_status, t.updated_at
  from projects p
  left join transcripts t on t.project_id = p.id
  order by p.updated_at desc
`);
console.log(connection.rows);
console.log(records.rows);
await pool.end();
