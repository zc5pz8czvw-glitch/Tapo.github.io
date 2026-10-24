// Teste pentru funcția server „mentor” (cu furnizorul AI simulat din supabase/local/mockai.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { newUser, mentor, client, ANON } from './helpers.mjs';

const ctx = { data_azi: '2026-10-24', progres: { nivel: 3 } };
const chat = (text, lang = 'ro') => ({ intent: 'chat', lang, feedback: 'direct', minutes: 30, context: ctx, turns: [{ role: 'user', content: text }] });

test('fără sesiune → 401; cu cheia publică în loc de token → 401', async () => {
  assert.equal((await mentor(null, chat('salut'))).status, 401);
  assert.equal((await mentor(ANON, chat('salut'))).status, 401);
  assert.equal((await mentor('abc.def.ghi', chat('salut'))).status, 401);
});

test('fără acord explicit pentru AI → 403 consent_required; starea arată acordul', async () => {
  const u = await newUser('mc');
  const r = await mentor(u.token, chat('salut'));
  assert.equal(r.status, 403);
  assert.equal(r.body.code, 'consent_required');
  const s = await mentor(u.token, { intent: 'status' });
  assert.equal(s.status, 200);
  assert.equal(s.body.consent, false);
  assert.equal(s.body.configured, true);
  assert.equal(s.body.limit, 15);
});

test('chat în cele trei limbi; cota scade', async () => {
  const u = await newUser('ml');
  await u.c.rpc('set_ai_consent', { p_consent: true });
  for (const lang of ['ro', 'en', 'ru']) {
    const r = await mentor(u.token, chat('ce fac azi?', lang));
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.match(r.body.text, new RegExp('Mock \\(' + lang + '\\)'));
  }
  const s = await mentor(u.token, { intent: 'status' });
  assert.equal(s.body.used, 3);
});

test('generare de misiuni → JSON; JSON stricat → invalid_json', async () => {
  const u = await newUser('mg');
  await u.c.rpc('set_ai_consent', { p_consent: true });
  const r = await mentor(u.token, { intent: 'generate', lang: 'en', minutes: 30, context: ctx, n: 2 });
  assert.equal(r.status, 200);
  assert.equal(r.body.json.suggestions.length, 2);
  assert.match(r.body.json.suggestions[0].title, /Mock en/);
  const b = await mentor(u.token, { intent: 'breakdown', lang: 'ro', minutes: 30, context: ctx, goal: 'vreau __BADJSON__ un produs' });
  assert.equal(b.status, 502);
  assert.equal(b.body.code, 'invalid_json');
});

test('cereri invalide → 400; context prea mare → 400/413', async () => {
  const u = await newUser('mi');
  await u.c.rpc('set_ai_consent', { p_consent: true });
  assert.equal((await mentor(u.token, { intent: 'hack' })).status, 400);
  assert.equal((await mentor(u.token, { intent: 'chat', turns: [] })).status, 400);
  const big = await mentor(u.token, { ...chat('x'), context: { blob: 'x'.repeat(20000) } });
  assert.equal(big.status, 400);
  assert.equal(big.body.field, 'context_too_large');
  const huge = await mentor(u.token, { ...chat('x'), context: { blob: 'x'.repeat(70000) } });
  assert.equal(huge.status, 413);
});

test('erori ale furnizorului: cota se returnează, codurile sunt clare', async () => {
  const u = await newUser('me');
  await u.c.rpc('set_ai_consent', { p_consent: true });
  const f = await mentor(u.token, chat('__FAIL__'));
  assert.equal(f.status, 502); assert.equal(f.body.code, 'upstream_error');
  const r = await mentor(u.token, chat('__RATE__'));
  assert.equal(r.status, 503); assert.equal(r.body.code, 'upstream_busy');
  const o = await mentor(u.token, chat('__OVERLOAD__'));
  assert.equal(o.status, 503); assert.equal(o.body.code, 'upstream_busy');
  const e = await mentor(u.token, chat('__EMPTY__'));
  assert.equal(e.status, 502); assert.equal(e.body.code, 'empty_completion');
  const s = await mentor(u.token, { intent: 'status' });
  assert.equal(s.body.used, 1, 'doar răspunsul gol (care a consumat tokeni) e numărat');
});

test('limită pe minut și cerere unică în curs', async () => {
  const u = await newUser('mr');
  await u.c.rpc('set_ai_consent', { p_consent: true });
  const codes = [];
  for (let i = 0; i < 8; i++) codes.push((await mentor(u.token, chat('m' + i))).body.code || 'ok');
  assert.deepEqual(codes.slice(0, 6), ['ok', 'ok', 'ok', 'ok', 'ok', 'ok']);
  assert.equal(codes[6], 'rate_limited');
});

test('timeout al furnizorului (35 s > 25 s) → 504, cota returnată; o a doua cerere simultană → busy', async () => {
  const u = await newUser('mt');
  await u.c.rpc('set_ai_consent', { p_consent: true });
  const slow = mentor(u.token, chat('__SLOW__'));
  await new Promise((r) => setTimeout(r, 1500));
  const second = await mentor(u.token, chat('altceva'));
  assert.equal(second.status, 429); assert.equal(second.body.code, 'busy');
  const t0 = Date.now();
  const s = await slow;
  assert.equal(s.status, 504, JSON.stringify(s.body)); assert.equal(s.body.code, 'timeout');
  assert.ok(Date.now() - t0 < 60000);
  const st = await mentor(u.token, { intent: 'status' });
  assert.equal(st.body.used, 0);
  const after = await mentor(u.token, chat('acum merge?'));
  assert.equal(after.status, 200);
});

test('cota zilnică se termină → 429 quota_exceeded', async () => {
  const u = await newUser('mq');
  await u.c.rpc('set_ai_consent', { p_consent: true });
  let last;
  for (let i = 0; i < 16; i++) {
    last = await mentor(u.token, chat('q' + i));
    if (last.body.code === 'rate_limited') { await new Promise((r) => setTimeout(r, 61000)); i--; continue; }
  }
  assert.equal(last.status, 429);
  assert.equal(last.body.code, 'quota_exceeded');
});

test('cont blocat administrativ → 403 account_disabled', async () => {
  const u = await newUser('md');
  await u.c.rpc('set_ai_consent', { p_consent: true });
  const { admin } = await import('./helpers.mjs');
  await admin().from('profiles').update({ disabled: true }).eq('id', u.uid);
  const r = await mentor(u.token, chat('salut'));
  assert.equal(r.status, 403); assert.equal(r.body.code, 'account_disabled');
  void client;
});
