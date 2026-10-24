// Aplică migrațiile din supabase/migrations pe baza de date locală (după ce serviciul auth a creat schema „auth”).
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
const dir = path.resolve(import.meta.dirname, '../supabase/migrations');
const url = process.env.DATABASE_URL || 'postgres://postgres:local-dev-postgres-password@localhost:54322/postgres';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const c = new pg.Client({ connectionString: url });
for (let i = 0; ; i++) { try { await c.connect(); break; } catch (e) { if (i > 60) throw e; await sleep(1000); } }
for (let i = 0; i < 90; i++) { const r = await c.query("select to_regclass('auth.users') as t"); if (r.rows[0].t) break; await sleep(1000); }
await c.query('create table if not exists public._migrations (name text primary key, applied_at timestamptz default now())');
await c.query('revoke all on public._migrations from anon, authenticated');
for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
  const done = await c.query('select 1 from public._migrations where name = $1', [f]);
  if (done.rowCount) continue;
  await c.query('begin');
  try { await c.query(fs.readFileSync(path.join(dir, f), 'utf8')); await c.query('insert into public._migrations (name) values ($1)', [f]); await c.query('commit'); console.log('aplicat', f); }
  catch (e) { await c.query('rollback'); console.error('EROARE în', f, e.message); process.exit(1); }
}
await c.end();
