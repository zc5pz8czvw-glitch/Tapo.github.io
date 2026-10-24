// Situații dificile: fără internet, server care nu răspunde, aplicație închisă în timpul salvării, pornire offline (PWA).
import test from 'node:test';
import assert from 'node:assert/strict';
import { start, onboard, sleep, APP } from './lib.mjs';
import { newUser } from '../backend/helpers.mjs';

/* autentificare directă (contul e creat prin API, ca testul să fie rapid) */
async function login(p, u) {
  await p.evaluate(async ({ e, pw }) => { const r = await Backend.signIn(e, pw); if (!r.ok) throw new Error(r.code); await afterSignIn(false); }, { e: u.email, pw: u.password });
  await p.waitForFunction(() => Host.hasCloud(), null, { timeout: 10000 });
}
const addXp = (p) => p.evaluate(() => {
  const q = S.quests.find((x) => Eng.isActive(x) && x.status !== 'completed');
  S.profile.goals = (S.profile.goals || []).concat(['obiectiv ' + Date.now()]).slice(-5);
  commit();
  return !!q;
});

test('fără internet: jocul merge, salvarea așteaptă, Mentorul răspunde local; la revenire se sincronizează', { timeout: 120000 }, async () => {
  const u = await newUser('off');
  const { b, ctx, p, errs } = await start({ lang: 'ro' });
  try {
    await onboard(p, 'Offline');
    await login(p, u);
    await p.evaluate(() => Ov.closeAll());
    await p.waitForFunction(() => Cloud.status().phase === 'saved', null, { timeout: 30000 });
    await ctx.setOffline(true); await sleep(300);
    await addXp(p);
    await p.evaluate(() => Cloud.flushNow());
    await p.waitForFunction(() => Cloud.status().phase === 'offline', null, { timeout: 10000 });
    // Mentorul: fără internet → răspuns local, cu explicație
    await p.evaluate(() => Backend.setAiConsent(true));
    const r = await p.evaluate(async () => { AI.resetHidden(); return await AI.ask(S, { intent: 'today' }); });
    assert.equal(r.ok, true); assert.equal(r.source, 'local');
    // salvarea locală merge în continuare
    const local = await p.evaluate(() => Store.status().mode);
    assert.notEqual(local, 'memory');
    // revine internetul → se salvează automat în cont
    await ctx.setOffline(false);
    await p.evaluate(() => window.dispatchEvent(new Event('online')));
    await p.waitForFunction(() => Cloud.status().phase === 'saved', null, { timeout: 30000 });
    const meta = await p.evaluate(async () => (await Backend.rpc('get_save_meta')).data);
    const rev = await p.evaluate(() => S.meta.cloudRev);
    assert.equal(meta.rev, rev);
    assert.deepEqual(errs, []);
  } finally { await b.close(); }
});

test('serverul nu răspunde: eroare clară, datele rămân locale, reîncercare automată', { timeout: 120000 }, async () => {
  const u = await newUser('down');
  const { b, p, errs } = await start({ lang: 'en' });
  try {
    await onboard(p, 'Down');
    await login(p, u);
    await p.evaluate(() => Ov.closeAll());
    await p.waitForFunction(() => Cloud.status().phase === 'saved', null, { timeout: 30000 });
    await p.route('**/rest/v1/**', (route) => route.abort('connectionrefused'));
    await p.route('**/functions/v1/**', (route) => route.fulfill({ status: 503, body: '{"ok":false,"code":"upstream_busy"}', contentType: 'application/json' }));
    await addXp(p);
    const r = await p.evaluate(async () => await Cloud.flushNow());
    assert.equal(r.ok, false);
    const ph = await p.evaluate(() => Cloud.status());
    assert.equal(ph.phase, 'error');
    // Mentorul: serviciu AI indisponibil → răspuns local + mesaj
    await p.evaluate(() => Backend.setAiConsent(true)).catch(() => {});
    await p.evaluate(() => { Backend.profile.ai_consent = true; AI.resetHidden(); });
    const a = await p.evaluate(async () => await AI.ask(S, { intent: 'chat', text: 'hello' }));
    assert.equal(a.ok, true); assert.equal(a.source, 'local'); assert.equal(a.fallback.code, 'upstream_busy');
    // serverul revine → reîncercarea (programată) reușește
    await p.unrouteAll({ behavior: 'ignoreErrors' });
    await p.evaluate(() => Cloud.flushNow());
    await p.waitForFunction(() => Cloud.status().phase === 'saved', null, { timeout: 30000 });
    assert.deepEqual(errs.filter((e) => !/net::|Failed to fetch/.test(e)), []);
  } finally { await b.close(); }
});

test('aplicația închisă imediat după o modificare: la repornire nu se pierde nimic și nu apare conflict fals', { timeout: 120000 }, async () => {
  const u = await newUser('kill');
  const { b, ctx, p, errs } = await start({ lang: 'ro' });
  try {
    await onboard(p, 'Kill');
    await login(p, u);
    await p.evaluate(() => Ov.closeAll());
    await p.waitForFunction(() => Cloud.status().phase === 'saved', null, { timeout: 30000 });
    await p.evaluate(() => { S.profile.goals = ['înainte de închidere']; commit(); Cloud.flushNow(); });
    await sleep(50);   // închidem în timp ce salvarea în cont e în curs
    const p2 = await ctx.newPage();
    await p.close();
    await p2.goto(APP); await sleep(1500);
    await p2.waitForFunction(() => typeof S !== 'undefined' && S && Host.caps.ready, null, { timeout: 15000 });
    await sleep(2500);
    const st = await p2.evaluate(() => ({ goals: S.profile.goals, conflict: Cloud.status().phase === 'conflict', dialog: Ov.has('cloudconf') }));
    assert.deepEqual(st.goals, ['înainte de închidere'], 'modificarea locală s-a păstrat');
    assert.equal(st.dialog, false, 'fără dialog de conflict pentru aceeași stare');
    await p2.waitForFunction(() => ['saved', 'idle', 'pending'].includes(Cloud.status().phase), null, { timeout: 30000 });
    assert.deepEqual(errs, []);
  } finally { await b.close(); }
});

test('PWA: după prima vizită pornește și fără internet', { timeout: 60000 }, async () => {
  const { b, ctx, p } = await start({ lang: 'ro', sw: true });
  try {
    await p.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller, null, { timeout: 20000 }).catch(async () => { await p.reload(); await p.waitForFunction(() => navigator.serviceWorker.controller, null, { timeout: 20000 }); });
    await onboard(p, 'Pwa');
    await ctx.setOffline(true);
    await p.reload(); await sleep(1500);
    const ok = await p.evaluate(() => !!(typeof S !== 'undefined' && S && S.profile.onboarded && document.querySelector('#nav:not([hidden])')));
    assert.equal(ok, true, 'jocul a pornit offline, cu progresul păstrat');
  } finally { await b.close(); }
});
