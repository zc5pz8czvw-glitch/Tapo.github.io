// Test complet în browser, pe stiva locală: cont nou → cod din e-mail → salvare în cont → Mentor AI (acord) →
// prieteni prin cod → al doilea dispozitiv (restaurare) → deconectare → ștergerea contului.
// Rulare: npm run test:e2e   (stiva locală pornită + aplicația construită cu app/config.local.json și servită pe :8080)
import test from 'node:test';
import assert from 'node:assert/strict';
import { start, onboard, sleep } from './lib.mjs';
import { otpFor, uniq, admin } from '../backend/helpers.mjs';

async function signUpUI(p, email, password) {
  await p.evaluate(() => go('profile')); await sleep(300);
  await p.click('[data-a="account-open"]'); await sleep(200);
  await p.click('[data-a="acc-mode"][data-v="signup"]'); await sleep(200);
  await p.fill('#acc-email', email);
  await p.fill('#acc-pw', password);
  await p.fill('#acc-pw2', password);
  await p.check('input[data-f="acc.age"]');
  await p.check('input[data-f="acc.agree"]');
  const t0 = Date.now();
  await p.click('#acc-go');
  await p.waitForSelector('#acc-code', { timeout: 15000 });
  const { code } = await otpFor(email, t0);
  await p.fill('#acc-code', code);
  await p.click('#acc-go');
  await p.waitForFunction(() => Host.hasCloud(), null, { timeout: 15000 });
  await sleep(800);
}

test('flux complet: cont, sincronizare, AI, prieteni, al doilea dispozitiv, ștergere', { timeout: 240000 }, async () => {
  const email = uniq('e2e'), password = 'Parola-E2E-123';
  const A = await start({ lang: 'ro' });
  try {
    await onboard(A.p, 'Ana');
    // o misiune finalizată, ca să existe progres
    await A.p.evaluate(() => { const q = S.quests.find((x) => Eng.isActive(x)); if (q) { const r = Eng.completeQuest ? Eng.completeQuest(S, q.id, { note: 'Am terminat capitolul și am notat ideile principale.' }) : null; } commit(); });
    await signUpUI(A.p, email, password);
    const st = await A.p.evaluate(() => ({ email: Backend.email, fc: Backend.profile && Backend.profile.friend_code, live: S.social.live }));
    assert.equal(st.email, email);
    assert.match(st.fc, /^[A-Z2-9]{8}$/);
    assert.equal(st.live, true);

    // salvarea în cont se face automat (după pauza de debounce)
    await A.p.waitForFunction(() => Cloud.status().phase === 'saved', null, { timeout: 30000 });
    const meta = await A.p.evaluate(async () => (await Backend.rpc('get_save_meta')).data);
    assert.ok(meta && meta.rev, 'există copie în cont');
    assert.equal(meta.summary.name, 'Ana');
    // numele afișat a ajuns pe server
    await A.p.waitForFunction(() => Backend.profile && Backend.profile.display_name === 'Ana', null, { timeout: 10000 });

    // Mentor AI: întâi cere acordul; după acord răspunde AI-ul (simulat)
    await A.p.evaluate(() => { Ov.closeAll(); go('mentor'); }); await sleep(400);
    let txt = await A.p.innerText('#view');
    assert.match(txt, /acord/i);
    await A.p.click('[data-a="ai-consent-open"]'); await sleep(200);
    await A.p.click('[data-a="ai-consent-yes"]');
    await A.p.waitForFunction(() => AI.status(S).aiAvailable, null, { timeout: 10000 });
    await A.p.fill('#mentor-in', 'Ce fac azi?');
    await A.p.click('#mentor-send');
    await A.p.waitForFunction(() => !UI.mentor.busy, null, { timeout: 40000 });
    const last = await A.p.evaluate(() => S.mentor.messages.filter((m) => m.role === 'assistant').pop());
    assert.equal(last.source, 'ai', 'răspuns de la AI');
    assert.match(last.text, /Mock \(ro\)/);
    txt = await A.p.innerText('#top');
    assert.match(txt, /AI activ · 14\/15 azi/);
    // raportarea unui răspuns AI
    await A.p.evaluate(() => { window.confirmBox = () => Promise.resolve(true); });
    const rep = await A.p.evaluate(async () => (await Social.report('ai_message', null, 'test')).ok);
    assert.equal(rep, true);
    // generare de misiuni prin AI
    await A.p.evaluate(() => mentorAsk({ intent: 'generate', n: 2 }, 'Generează misiuni'));
    await A.p.waitForFunction(() => !UI.mentor.busy, null, { timeout: 40000 });
    const sg = await A.p.evaluate(() => S.mentor.suggestions.filter((x) => x.status === 'pending' && x.origin === 'ai').length);
    assert.ok(sg >= 1, 'sugestii AI adăugate: ' + sg);

    // prieten: al doilea jucător (alt browser) adaugă codul primului
    const B = await start({ lang: 'en' });
    try {
      await onboard(B.p, 'Bogdan');
      await signUpUI(B.p, uniq('e2eb'), password);
      await B.p.evaluate(() => { Ov.closeAll(); UI.pgTab = 'lb'; go('progress'); }); await sleep(500);
      await B.p.fill('#lb-in', st.fc.slice(0, 4) + '-' + st.fc.slice(4));
      await B.p.click('#lb-add');
      await B.p.waitForFunction(() => Social.board(S, 'xp').some((c) => c.n === 'Ana'), null, { timeout: 15000 });
      // A vede automat pe B (după reîmprospătare)
      await A.p.evaluate(() => Social.refresh(true));
      await A.p.waitForFunction(() => Social.board(S, 'xp').some((c) => c.n === 'Bogdan'), null, { timeout: 15000 });
      // B blochează A → dispar unul din clasamentul celuilalt
      const aUid = await A.p.evaluate(() => Backend.uid);
      assert.equal(await B.p.evaluate(async (u) => (await Social.block(u)).ok, aUid), true);
      await A.p.evaluate(() => Social.refresh(true)); await sleep(500);
      assert.equal(await A.p.evaluate(() => Social.board(S, 'xp').some((c) => c.n === 'Bogdan')), false);
      assert.deepEqual(B.errs, []);
    } finally { await B.b.close(); }

    // al doilea dispozitiv al Anei: autentificare → propune restaurarea din cont
    await A.p.evaluate(() => Cloud.flushNow()); await sleep(500);
    const D = await start({ lang: 'ru' });
    try {
      await onboard(D.p, 'Altcineva');
      await D.p.evaluate(() => go('profile')); await sleep(200);
      await D.p.click('[data-a="account-open"]'); await sleep(200);
      await D.p.click('[data-a="acc-mode"][data-v="signin"]'); await sleep(150);
      await D.p.fill('#acc-email', email); await D.p.fill('#acc-pw', password);
      await D.p.click('#acc-go');
      await D.p.waitForSelector('[data-a="cloud-restore"]', { timeout: 20000 });   // conflict: copii diferite
      await D.p.evaluate(() => { window.confirmBox = () => Promise.resolve(true); });
      await D.p.click('[data-a="cloud-restore"]');
      await D.p.waitForFunction(() => S && S.profile.name === 'Ana', null, { timeout: 15000 });
      assert.deepEqual(D.errs, []);
      // parolă greșită → mesaj clar
      await D.p.evaluate(() => Backend.signOut()); await sleep(300);
      const bad = await D.p.evaluate(async (e) => await Backend.signIn(e, 'gresit-123'), email);
      assert.equal(bad.ok, false); assert.equal(bad.code, 'invalid_credentials');
    } finally { await D.b.close(); }

    // ștergerea contului din aplicație
    const uid = await A.p.evaluate(() => Backend.uid);
    await A.p.evaluate(() => { Ov.closeAll(); go('profile'); }); await sleep(200);
    await A.p.click('[data-a="account-open"]'); await sleep(200);
    await A.p.click('[data-a="acc-delete"]');
    await A.p.waitForFunction(() => !Backend.signedIn(), null, { timeout: 15000 });
    const left = await admin().from('profiles').select('id').eq('id', uid);
    assert.equal(left.data.length, 0, 'profilul a dispărut de pe server');
    // jocul local a rămas
    assert.equal(await A.p.evaluate(() => S.profile.name), 'Ana');
    assert.deepEqual(A.errs, []);
  } finally { await A.b.close(); }
});
