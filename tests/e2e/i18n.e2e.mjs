// Limbi: în engleză și rusă nu trebuie să rămână text românesc în interfață (inclusiv ecranele noi: cont, serie, clasament).
import test from 'node:test';
import assert from 'node:assert/strict';
import { start, onboard, sleep } from './lib.mjs';

const RO = /[ăâîșțĂÂÎȘȚşţ]|\b(și|sau|pentru|[Mm]isiun\w*|zile|azi|[Nn]ivel\w*|să|cu|nu|este|ești|pe|din|mai|încă|care|acest|această|fără|după|până|când|dacă|cont|prieten\w*)\b/;
const IGNORE = /LIFE RPG|XP|LRPG1[\w.-]*|IndexedDB|localStorage|JSON|WhatsApp|Messenger|SMS|Lucide|Game-icons\.net|Lorc|Delapouite|Poppins|Montserrat|SIL Open Font License|CC BY|ISC|Română|English|Русский|Reality Check|Boss Battle|Focus|Test|Ana|Lun|Mar|Mie|Joi|Vin|Sâm|Dum|Anthropic \(Claude\)|App Store|\.json|support@example\.com/g;

async function scan(p, found, where) {
  const txt = await p.evaluate(() => {
    const out = []; const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n;
    while ((n = w.nextNode())) { const el = n.parentElement; if (!el || el.closest('script,style,textarea,noscript,.code-box')) continue; const t = n.textContent.trim(); if (t) out.push(t); }
    document.querySelectorAll('[placeholder],[aria-label]').forEach((e) => { ['placeholder', 'aria-label'].forEach((a) => { const v = e.getAttribute(a); if (v) out.push(v); }); });
    return out;
  });
  for (const t of txt) { const t2 = t.replace(IGNORE, ''); if (RO.test(t2) && !found.has(t)) found.set(t, where); }
}

for (const lang of ['en', 'ru']) {
  test('fără text românesc rămas: ' + lang, { timeout: 120000 }, async () => {
    const { b, p, errs } = await start({ lang });
    const found = new Map();
    try {
      await onboard(p, 'Ana');
      for (const r of ['home', 'quests', 'skills', 'mentor', 'progress', 'profile', 'stats', 'focus', 'review', 'reality', 'weekly']) { await p.evaluate((x) => { Ov.closeAll(); go(x); }, r); await sleep(250); await scan(p, found, r); }
      await p.evaluate(() => { UI.pgTab = 'lb'; go('progress'); }); await sleep(250); await scan(p, found, 'leaderboard');
      const sheets = [['streak-open', null], ['account-open', null], ['notif-open', null], ['about-open', null], ['mentor-info', null]];
      for (const [a] of sheets) { await p.evaluate((x) => { Ov.closeAll(); A[x](); }, a); await sleep(250); await scan(p, found, a); }
      for (const m of ['signup', 'signin', 'reset']) { await p.evaluate((x) => { Ov.closeAll(); A['account-open'](); UI.forms.acc.mode = x; Ov.refresh('cloud'); }, m); await sleep(200); await scan(p, found, 'acc:' + m); }
      // mesajele mentorului local și motivele pentru care AI lipsește
      await p.evaluate(async () => { for (const i of ['today', 'analyze', 'status']) { const r = await AI.ask(S, { intent: i, mode: 'local' }); Eng.addMessage(S, 'assistant', r.text, 'local'); } commit(); Ov.closeAll(); go('mentor'); });
      await sleep(300); await scan(p, found, 'mentor-local');
      // evenimentele seriei (toasturi)
      await p.evaluate(() => { processEvents([{ kind: 'shield_earned', shields: 1 }, { kind: 'shield_used', n: 2, streak: 5 }, { kind: 'comeback_offer', prev: 6 }, { kind: 'comeback_done', prev: 6 }, { kind: 'milestone', days: 30 }]); });
      await sleep(200); await scan(p, found, 'toasts');
      const list = Array.from(found).map(([t, w]) => '[' + w + '] ' + t.slice(0, 120));
      assert.deepEqual(list, [], 'text netradus:\n' + list.join('\n'));
      assert.deepEqual(errs, []);
    } finally { await b.close(); }
  });
}
