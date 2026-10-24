// Securitate în interfață: nume de jucători și răspunsuri AI cu cod HTML/JS nu trebuie să se execute (XSS).
import test from 'node:test';
import assert from 'node:assert/strict';
import { start, onboard, sleep } from './lib.mjs';
import { newUser } from '../backend/helpers.mjs';

test('XSS: nume de prieten și text AI sunt afișate ca text, nu executate', { timeout: 120000 }, async () => {
  const evil = await newUser('xss');
  const payload = '<img src=x onerror=window.__pwn=1>';
  const up = await evil.c.rpc('update_profile', { p_display_name: payload.slice(0, 24) });
  await evil.c.rpc('publish_card', { p_level: 2, p_xp: 50, p_week_xp: 50, p_week_start: null, p_streak: 1, p_best_streak: 1, p_quests: 1, p_achievements: 0 });
  const { b, p, errs } = await start({ lang: 'ro' });
  try {
    await onboard(p, 'Victima');
    const me = await newUser('xssv');
    await p.evaluate(async ({ e, pw }) => { await Backend.signIn(e, pw); await afterSignIn(false); }, { e: me.email, pw: me.password });
    const code = (await evil.c.rpc('get_my_profile')).data.friend_code;
    await p.evaluate(async (c) => { await Social.addFriendCode(c); }, code);
    await p.evaluate(() => { Ov.closeAll(); UI.pgTab = 'lb'; go('progress'); }); await sleep(600);
    // răspuns „AI” cu HTML periculos, randat în chat
    await p.evaluate(() => { Eng.addMessage(S, 'assistant', 'Salut <script>window.__pwn=2</script><img src=y onerror="window.__pwn=3"> **bold** [x](javascript:window.__pwn=4)', 'ai'); commit(); go('mentor'); });
    await sleep(600);
    const r = await p.evaluate(() => ({ pwn: window.__pwn || 0, imgs: document.querySelectorAll('#view img').length, scripts: document.querySelectorAll('#view script').length, jsLinks: document.querySelectorAll('#view a[href^="javascript"]').length }));
    assert.equal(r.pwn, 0, 'cod injectat executat'); assert.equal(r.imgs, 0); assert.equal(r.scripts, 0); assert.equal(r.jsLinks, 0);
    assert.ok(up.data.ok === true || up.data.ok === false);
    assert.deepEqual(errs, []);
  } finally { await b.close(); }
});
