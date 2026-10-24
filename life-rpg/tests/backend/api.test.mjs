// Teste de backend: conturi, salvare, izolarea datelor, prieteni, ligă, raportări, ștergerea contului.
// Rulare: npm run test:backend   (cu stiva locală pornită: supabase/local/dc.sh up -d)
import test from 'node:test';
import assert from 'node:assert/strict';
import { client, admin, newUser, otpFor, uniq, savePayload, sleep } from './helpers.mjs';

test('înregistrare cu cod pe e-mail, profil creat automat, cod de prieten', async () => {
  const u = await newUser('reg');
  const { data, error } = await u.c.rpc('get_my_profile');
  assert.equal(error, null);
  assert.equal(data.id, u.uid);
  assert.match(data.friend_code, /^[A-HJ-NP-Z2-9]{8}$/);
  assert.equal(data.plan, 'free');
  assert.equal(data.ai_consent, false);
});

test('fără confirmarea e-mailului nu există sesiune', async () => {
  const c = client(), email = uniq('nc');
  const s = await c.auth.signUp({ email, password: 'Parola-Test-123' });
  assert.equal(s.data.session, null);
  const l = await c.auth.signInWithPassword({ email, password: 'Parola-Test-123' });
  assert.ok(l.error, 'login refuzat înainte de confirmare');
});

test('cod greșit refuzat; parolă slabă refuzată', async () => {
  const c = client(), email = uniq('bad');
  const weak = await c.auth.signUp({ email: uniq('weak'), password: '123' });
  assert.ok(weak.error);
  await c.auth.signUp({ email, password: 'Parola-Test-123' });
  const v = await c.auth.verifyOtp({ email, token: '000000', type: 'signup' });
  assert.ok(v.error);
});

test('resetarea parolei prin cod (fără linkuri)', async () => {
  const u = await newUser('rst');
  const c = client();
  const t0 = Date.now();
  await sleep(1100); // limita de frecvență a e-mailurilor
  const r = await c.auth.resetPasswordForEmail(u.email);
  assert.equal(r.error, null);
  const { code } = await otpFor(u.email, t0);
  const v = await c.auth.verifyOtp({ email: u.email, token: code, type: 'recovery' });
  assert.equal(v.error, null);
  const up = await c.auth.updateUser({ password: 'Parola-Noua-456' });
  assert.equal(up.error, null);
  const old = await client().auth.signInWithPassword({ email: u.email, password: u.password });
  assert.ok(old.error, 'parola veche nu mai merge');
  const ok = await client().auth.signInWithPassword({ email: u.email, password: 'Parola-Noua-456' });
  assert.equal(ok.error, null);
});

test('nume afișat: validare și filtru', async () => {
  const u = await newUser('name');
  for (const bad of ['a', 'Fuck you', 'xXpizdaXx', 'www.spam.com', 'хуй']) {
    const { data } = await u.c.rpc('update_profile', { p_display_name: bad });
    assert.equal(data.ok, false, 'respins: ' + bad);
  }
  for (const good of ['Ana', 'Ștefan Mărgărit', 'Дмитрий', 'Făgăraș Fan']) {
    const { data } = await u.c.rpc('update_profile', { p_display_name: good });
    assert.equal(data.ok, true, 'acceptat: ' + good);
  }
  const { data } = await u.c.rpc('update_profile', { p_display_name: 'Ana Maria Popescu Lungă Foarte' });
  assert.equal(data.profile.display_name.length <= 24, true);
});

test('salvare: prima scriere, conflict, adoptare, forțare, limită de frecvență', async () => {
  const u = await newUser('save');
  let r = await u.c.rpc('push_save', savePayload('rv_a1', '11111111'));
  assert.deepEqual(r.data, { ok: true, rev: 'rv_a1' });
  // alt dispozitiv nu știe de rv_a1 → conflict
  r = await u.c.rpc('push_save', savePayload('rv_b1', '22222222'));
  assert.equal(r.data.code, 'conflict');
  assert.equal(r.data.remote.rev, 'rv_a1');
  // același conținut → adoptat fără scriere
  r = await u.c.rpc('push_save', savePayload('rv_c1', '11111111'));
  assert.equal(r.data.adopted, true);
  // scriere prea rapidă după precedenta
  r = await u.c.rpc('push_save', savePayload('rv_a2', '33333333', { p_expected_rev: 'rv_a1' }));
  assert.equal(r.data.code, 'rate_limited');
  await sleep(2100);
  r = await u.c.rpc('push_save', savePayload('rv_a2', '33333333', { p_expected_rev: 'rv_a1' }));
  assert.equal(r.data.ok, true);
  // forțare (decizia utilizatorului)
  r = await u.c.rpc('push_save', savePayload('rv_f1', '44444444', { p_force: true }));
  assert.equal(r.data.ok, true);
  const meta = await u.c.rpc('get_save_meta');
  assert.equal(meta.data.rev, 'rv_f1');
  const row = await u.c.from('saves').select('data,rev').single();
  assert.equal(row.data.rev, 'rv_f1');
  // copie prea mare
  r = await u.c.rpc('push_save', savePayload('rv_big', '55555555', { p_force: true, p_data: 'x'.repeat(4000001) }));
  assert.equal(r.data.code, 'too_large');
});

test('izolare: un jucător nu poate citi sau modifica datele altuia', async () => {
  const a = await newUser('isoa'), b = await newUser('isob');
  await a.c.rpc('push_save', savePayload('rv_iso', 'aaaaaaaa'));
  const sel = await b.c.from('saves').select('*');
  assert.equal(sel.error, null);
  assert.equal(sel.data.length, 0, 'B nu vede salvarea lui A');
  const prof = await b.c.from('profiles').select('*');
  assert.equal(prof.data.length, 1);
  assert.equal(prof.data[0].id, b.uid);
  // scrieri directe în tabele: interzise (inclusiv auto-promovarea la „premium”)
  const up = await b.c.from('profiles').update({ plan: 'premium' }).eq('id', b.uid).select();
  assert.ok(up.error || up.data.length === 0);
  assert.equal((await b.c.rpc('get_my_profile')).data.plan, 'free');
  const ins = await b.c.from('saves').insert({ user_id: a.uid, rev: 'hack', enc: 'json', data: '{}', bytes: 2, checksum: '00000000', hash: '00000000', schema_version: 1 });
  assert.ok(ins.error);
  const del = await b.c.from('saves').delete().eq('user_id', a.uid).select();
  assert.ok(del.error || del.data.length === 0);
  // funcțiile rezervate serverului (cote AI) nu pot fi apelate de client
  const take = await b.c.rpc('ai_take', { p_user: b.uid, p_daily: 9999, p_per_minute: 999, p_global_daily: 99999 });
  assert.ok(take.error);
  const fin = await b.c.rpc('ai_finish', { p_user: b.uid, p_ok: false, p_tokens_in: 0, p_tokens_out: 0 });
  assert.ok(fin.error);
  // raportările nu sunt citibile
  const rep = await b.c.from('reports').select('*');
  assert.ok(rep.error || rep.data.length === 0);
  // salvarea lui A e intactă
  assert.equal((await a.c.rpc('get_save_meta')).data.rev, 'rv_iso');
});

test('fără cont (cheia publică) nu se poate face nimic', async () => {
  const c = client();
  for (const [fn, args] of [['get_my_profile', {}], ['push_save', savePayload('rv_x', '12345678')], ['friends_board', {}], ['delete_my_account', {}], ['add_friend', { p_code: 'ABCDEFGH' }]]) {
    const r = await c.rpc(fn, args);
    assert.ok(r.error || (r.data && r.data.ok === false) || r.data === null || (Array.isArray(r.data) && r.data.length === 0), fn);
  }
  const s = await c.from('saves').select('*');
  assert.ok(s.error || s.data.length === 0);
});

test('prieteni prin cod, clasament, blocare', async () => {
  const a = await newUser('fra'), b = await newUser('frb'), c3 = await newUser('frc');
  await a.c.rpc('update_profile', { p_display_name: 'Alice' });
  await b.c.rpc('update_profile', { p_display_name: 'Bogdan' });
  const codeB = (await b.c.rpc('get_my_profile')).data.friend_code;
  assert.equal((await a.c.rpc('add_friend', { p_code: 'zzzz' })).data.code, 'invalid_code');
  assert.equal((await a.c.rpc('add_friend', { p_code: (await a.c.rpc('get_my_profile')).data.friend_code })).data.code, 'self');
  assert.equal((await a.c.rpc('add_friend', { p_code: codeB.toLowerCase().slice(0, 4) + '-' + codeB.slice(4) })).data.ok, true);
  await b.c.rpc('publish_card', { p_level: 3, p_xp: 500, p_week_xp: 200, p_week_start: null, p_streak: 4, p_best_streak: 4, p_quests: 10, p_achievements: 2 });
  const boardA = (await a.c.rpc('friends_board')).data;
  assert.equal(boardA.length, 2);
  const rowB = boardA.find((r) => r.user_id === b.uid);
  assert.equal(rowB.display_name, 'Bogdan');
  assert.equal(Number(rowB.xp), 500);
  assert.equal(rowB.email, undefined, 'fără e-mail în clasament');
  // C nu este prieten: nu apare la A, iar A nu apare la C
  assert.equal((await c3.c.rpc('friends_board')).data.length, 1);
  // B blochează A: prietenia dispare, A nu-l mai poate adăuga
  assert.equal((await b.c.rpc('block_user', { p_user: a.uid })).data.ok, true);
  assert.equal((await a.c.rpc('friends_board')).data.length, 1);
  assert.equal((await a.c.rpc('add_friend', { p_code: codeB })).data.code, 'not_found');
  assert.equal((await b.c.rpc('list_blocked')).data.length, 1);
  await b.c.rpc('unblock_user', { p_user: a.uid });
  assert.equal((await a.c.rpc('add_friend', { p_code: codeB })).data.ok, true);
  assert.equal((await a.c.rpc('remove_friend', { p_friend: b.uid })).data.ok, true);
  assert.equal((await b.c.rpc('friends_board')).data.length, 1);
});

test('cartea de joc: creșteri neplauzibile plafonate', async () => {
  const u = await newUser('card');
  await u.c.rpc('publish_card', { p_level: 5, p_xp: 1000, p_week_xp: 300, p_week_start: null, p_streak: 1, p_best_streak: 1, p_quests: 3, p_achievements: 0 });
  await sleep(3100);
  const r = await u.c.rpc('publish_card', { p_level: 99, p_xp: 99999999, p_week_xp: 9999999, p_week_start: null, p_streak: 1, p_best_streak: 1, p_quests: 3, p_achievements: 0 });
  assert.equal(r.data.ok, true);
  assert.ok(r.data.xp <= 1000 + 8000, 'xp plafonat: ' + r.data.xp);
  const rr = await u.c.rpc('publish_card', { p_level: 5, p_xp: 1000, p_week_xp: 1, p_week_start: null, p_streak: 1, p_best_streak: 1, p_quests: 3, p_achievements: 0 });
  assert.equal(rr.data.code, 'rate_limited');
});

test('liga săptămânală: doar cine alege apare; blocații nu apar', async () => {
  const a = await newUser('lga'), b = await newUser('lgb');
  const week = (await a.c.rpc('league_board')).data; // ok gol sau cu alții
  assert.ok(Array.isArray(week));
  const ws = new Date(); const d = (ws.getUTCDay() + 6) % 7; ws.setUTCDate(ws.getUTCDate() - d); const wk = ws.toISOString().slice(0, 10);
  await a.c.rpc('update_profile', { p_display_name: 'LigaA', p_league_opt_in: true });
  await b.c.rpc('update_profile', { p_display_name: 'LigaB', p_league_opt_in: false });
  await a.c.rpc('publish_card', { p_level: 2, p_xp: 300, p_week_xp: 300, p_week_start: wk, p_streak: 1, p_best_streak: 1, p_quests: 2, p_achievements: 0 });
  await b.c.rpc('publish_card', { p_level: 2, p_xp: 400, p_week_xp: 400, p_week_start: wk, p_streak: 1, p_best_streak: 1, p_quests: 2, p_achievements: 0 });
  let rows = (await b.c.rpc('league_board', { p_week: wk })).data;
  assert.ok(rows.some((r) => r.user_id === a.uid));
  assert.ok(!rows.some((r) => r.user_id === b.uid), 'B nu a ales liga');
  await b.c.rpc('block_user', { p_user: a.uid });
  rows = (await b.c.rpc('league_board', { p_week: wk })).data;
  assert.ok(!rows.some((r) => r.user_id === a.uid), 'A blocat nu mai apare la B');
});

test('raportări: acceptate, limitate', async () => {
  const a = await newUser('rpa'), b = await newUser('rpb');
  const r = await a.c.rpc('report_content', { p_kind: 'name', p_target: b.uid, p_details: 'nume ofensator' });
  assert.equal(r.data.ok, true);
  assert.equal((await a.c.rpc('report_content', { p_kind: 'altceva' })).data.ok, false);
  const rows = await admin().from('reports').select('*').eq('reporter', a.uid);
  assert.equal(rows.data.length, 1);
});

test('erori din aplicație: înregistrate (doar cu cont)', async () => {
  const u = await newUser('err');
  const r = await u.c.rpc('log_client_error', { p_message: 'TypeError: x', p_detail: 'stack', p_app_version: '5.0.0', p_platform: 'ios' });
  assert.equal(r.data.ok, true);
  const rows = await admin().from('client_errors').select('*').eq('user_id', u.uid);
  assert.equal(rows.data.length, 1);
});

test('ștergerea contului șterge toate datele', async () => {
  const u = await newUser('del'), f = await newUser('delf');
  await u.c.rpc('push_save', savePayload('rv_del', 'dddddddd'));
  await u.c.rpc('add_friend', { p_code: (await f.c.rpc('get_my_profile')).data.friend_code });
  await u.c.rpc('publish_card', { p_level: 1, p_xp: 10, p_week_xp: 10, p_week_start: null, p_streak: 0, p_best_streak: 0, p_quests: 1, p_achievements: 0 });
  await u.c.rpc('log_client_error', { p_message: 'x' });
  const r = await u.c.rpc('delete_my_account');
  assert.deepEqual(r.data, { ok: true });
  const ad = admin();
  for (const [t, col] of [['profiles', 'id'], ['saves', 'user_id'], ['player_cards', 'user_id'], ['friendships', 'user_id'], ['friendships', 'friend_id'], ['client_errors', 'user_id']]) {
    const q = await ad.from(t).select('*').eq(col, u.uid);
    assert.equal(q.data.length, 0, t + '.' + col);
  }
  const au = await ad.auth.admin.getUserById(u.uid);
  assert.ok(au.error || !au.data.user);
  const l = await client().auth.signInWithPassword({ email: u.email, password: u.password });
  assert.ok(l.error);
  assert.equal((await f.c.rpc('friends_board')).data.length, 1, 'prietenul nu mai vede contul șters');
});
