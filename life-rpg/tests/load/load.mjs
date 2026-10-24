// Test de încărcare pe stiva locală: N jucători simultani care fac ce face aplicația (verificare copie, salvare,
// clasament, carte de joc) + o rafală de cereri către Mentorul AI (furnizor simulat).
// Rezultatele sunt orientative: stiva locală nu are aceleași resurse ca planul Supabase pe care îl alegi.
// Rulare: node tests/load/load.mjs [utilizatori=60] [secunde=60]
import { admin, client, ENV, URL_API, ANON } from '../backend/helpers.mjs';
import zlib from 'node:zlib';

const N = Number(process.argv[2] || 60), SECS = Number(process.argv[3] || 60);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : 0; };
void ENV;

console.log(`Creez ${N} conturi de test…`);
const ad = admin(), users = [];
for (let i = 0; i < N; i++) {
  const email = `load${Date.now().toString(36)}${i}@test.liferpg.local`, password = 'Parola-Load-123';
  const { error } = await ad.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const c = client(); const s = await c.auth.signInWithPassword({ email, password }); if (s.error) throw s.error;
  await c.rpc('set_ai_consent', { p_consent: true });
  users.push({ c, token: s.data.session.access_token, rev: null });
}
/* fiecare al doilea jucător e prieten cu următorul */
for (let i = 0; i + 1 < N; i += 2) { const code = (await users[i + 1].c.rpc('get_my_profile')).data.friend_code; await users[i].c.rpc('add_friend', { p_code: code }); }

const state = JSON.stringify({ profile: { name: 'Load', onboarded: true }, quests: Array.from({ length: 40 }, (_, i) => ({ id: 'q' + i, title: 'Misiune de test ' + i, steps: [1, 2, 3] })), xpLog: Array.from({ length: 300 }, (_, i) => ({ id: 't' + i, amount: 10, dateKey: '2026-10-01' })) });
const data = zlib.gzipSync(state).toString('base64');
const lat = {}, errs = {}; let ops = 0;
const rec = (k, ms, ok) => { (lat[k] = lat[k] || []).push(ms); ops++; if (!ok) errs[k] = (errs[k] || 0) + 1; };
async function timed(k, fn) { const t = Date.now(); let ok = true; try { const r = await fn(); ok = !(r && r.error) && !(r && r.data && r.data.ok === false && !['rate_limited', 'conflict'].includes(r.data.code)); } catch { ok = false; } rec(k, Date.now() - t, ok); }

console.log(`Rulez ${SECS} s cu ${N} jucători simultani…`);
const end = Date.now() + SECS * 1000;
let n = 0;
await Promise.all(users.map(async (u, i) => {
  await sleep(Math.random() * 2000);
  while (Date.now() < end) {
    await timed('get_save_meta', () => u.c.rpc('get_save_meta'));
    const rev = 'rv_' + i + '_' + (n++);
    await timed('push_save', async () => { const r = await u.c.rpc('push_save', { p_expected_rev: u.rev, p_rev: rev, p_enc: 'gz', p_data: data, p_bytes: state.length, p_checksum: '0000abcd', p_hash: (n % 0xffffffff).toString(16).padStart(8, '0').slice(-8), p_schema: 1, p_device_id: 'd', p_save_count: n, p_updated_at: Date.now(), p_summary: { name: 'Load', level: 3, totalXp: 900 }, p_force: false }); if (r.data && r.data.ok) u.rev = r.data.rev; return r; });
    await timed('friends_board', () => u.c.rpc('friends_board'));
    await timed('publish_card', () => u.c.rpc('publish_card', { p_level: 3, p_xp: 900, p_week_xp: 100, p_week_start: null, p_streak: 2, p_best_streak: 2, p_quests: 9, p_achievements: 1 }));
    await sleep(3000 + Math.random() * 2000);   // un jucător real trimite mult mai rar (salvare la ~15 s după modificări)
  }
}));

console.log('Rafală Mentor AI: câte o cerere de la fiecare jucător, simultan…');
const tm = Date.now();
const mres = await Promise.all(users.map(async (u) => {
  const t = Date.now();
  const r = await fetch(URL_API + '/functions/v1/mentor', { method: 'POST', headers: { 'content-type': 'application/json', apikey: ANON, authorization: 'Bearer ' + u.token }, body: JSON.stringify({ intent: 'chat', lang: 'ro', minutes: 30, context: { a: 1 }, turns: [{ role: 'user', content: 'Ce fac azi?' }] }) });
  return { status: r.status, ms: Date.now() - t };
}));

const report = { users: N, seconds: SECS, operations: ops, throughput_ops_per_s: +(ops / SECS).toFixed(1), endpoints: {} };
for (const k of Object.keys(lat)) report.endpoints[k] = { calls: lat[k].length, p50_ms: pct(lat[k], 0.5), p95_ms: pct(lat[k], 0.95), max_ms: Math.max(...lat[k]), errors: errs[k] || 0 };
report.mentor_burst = { requests: mres.length, ok: mres.filter((x) => x.status === 200).length, statuses: mres.reduce((a, x) => ((a[x.status] = (a[x.status] || 0) + 1), a), {}), p50_ms: pct(mres.map((x) => x.ms), 0.5), p95_ms: pct(mres.map((x) => x.ms), 0.95), total_ms: Date.now() - tm };
console.log(JSON.stringify(report, null, 2));
