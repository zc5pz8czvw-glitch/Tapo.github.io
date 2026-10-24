// Seria: scuturi, zile libere, misiunea de revenire, praguri (logica din motorul jocului, rulată în pagină).
import test from 'node:test';
import assert from 'node:assert/strict';
import { start, onboard } from './lib.mjs';

test('seria: punți, scuturi, zile libere, revenire', { timeout: 60000 }, async () => {
  const { b, p, errs } = await start({ lang: 'ro' });
  try {
    await onboard(p, 'Serie');
    const r = await p.evaluate(() => {
      const td = U.dateKey(), D = (n) => U.addDays(td, -n);
      const fresh = () => { const s = Val.defaultState(); s.profile.onboarded = true; return s; };
      const act = (s, keys) => { for (const k of keys) s.xpLog.push({ id: U.uid('tx'), key: 'k' + k + Math.random(), type: 'quest', amount: 10, dateKey: k, at: U.parseKey(k).getTime() + 3600000, reason: 't', attrs: [], meta: {} }); };
      const out = {};
      // 1. fără punte: ziua lipsă rupe seria
      let s = fresh(); act(s, [D(5), D(4), D(3), D(1)]);
      out.noBridge = Stats.core(s).streak;
      // 2. cu punte (scut folosit pe D(2)): seria continuă, dar ziua-punte nu se numără
      s.streak.bridged = [D(2)];
      out.bridged = Stats.core(s).streak;
      // 3. zi liberă pe ziua săptămânii lui D(2)
      s = fresh(); act(s, [D(5), D(4), D(3), D(1)]); s.settings.restDays = [U.parseKey(D(2)).getDay()];
      out.rest = Stats.core(s).streak;
      // 4. rollover: o zi pierdută, un scut disponibil → folosit automat
      s = fresh(); act(s, [D(4), D(3), D(2)]); s.streak.shields = 1; s.meta.lastTick = D(1);
      const ro = Eng.rollover(s);
      out.shieldUsed = ro.shieldsUsed; out.shieldsLeft = s.streak.shields; out.afterShield = Stats.core(s).streak;
      Eng.drain();
      // 5. pauză de 3 zile, un singur scut → scutul NU se irosește; se oferă revenirea
      s = fresh(); act(s, [D(6), D(5), D(4)]); s.streak.shields = 1; s.meta.lastTick = D(1);
      Eng.rollover(s);
      out.cbOffered = !!s.streak.comeback; out.cbPrev = s.streak.comeback && s.streak.comeback.prev; out.shieldKept = s.streak.shields;
      Eng.drain();
      // 6. revenirea reușită: 3 zile active la rând de la start → seria veche revine
      s = fresh(); act(s, [D(9), D(8), D(7), D(6)]);
      s.streak.comeback = { start: D(2), prev: 4, gap: [D(5), D(4), D(3)] };
      act(s, [D(2), D(1), td]);
      Eng.after(s);
      out.cbDone = !s.streak.comeback; out.cbStreak = Stats.core(s).streak; out.cbAt = !!s.streak.comebackAt;
      const evs = Eng.drain(); out.cbEvent = evs.some((e) => e.kind === 'comeback_done');
      // 7. revenirea pierdută: o zi lipsă în fereastră
      s = fresh(); s.streak.comeback = { start: D(2), prev: 4, gap: [D(5)] }; act(s, [D(2), td]);
      Eng.after(s); out.cbLost = !s.streak.comeback; Eng.drain();
      // 8. scut câștigat în a 7-a zi la rând (o singură dată pe zi), plafon 2
      s = fresh(); act(s, [D(6), D(5), D(4), D(3), D(2), D(1), td]);
      Eng.after(s); Eng.after(s);
      out.earned = s.streak.shields; out.ms7 = !!s.streak.milestones[7];
      const e2 = Eng.drain(); out.earnEvents = e2.filter((e) => e.kind === 'shield_earned').length;
      s.streak.shields = 2; s.streak.lastAwardKey = null; Eng.after(s); out.capped = s.streak.shields;
      Eng.drain();
      // 9. reparare: valori greșite în stare
      const bad = Val.repair(Object.assign(fresh(), { streak: { shields: 99, bridged: ['x', D(1)], comeback: { start: 'nu' } }, settings: Object.assign(fresh().settings, { restDays: [1, 2, 3, 9], notify: { on: 'da', time: '25:99' } }) })).state;
      out.repShields = bad.streak.shields; out.repBridged = bad.streak.bridged; out.repCb = bad.streak.comeback; out.repRest = bad.settings.restDays; out.repNotify = bad.settings.notify;
      return out;
    });
    assert.equal(r.noBridge, 1);
    assert.equal(r.bridged, 4);
    assert.equal(r.rest, 4);
    assert.equal(r.shieldUsed, 1); assert.equal(r.shieldsLeft, 0); assert.equal(r.afterShield, 3);
    assert.equal(r.cbOffered, true); assert.equal(r.cbPrev, 3); assert.equal(r.shieldKept, 1);
    assert.equal(r.cbDone, true); assert.equal(r.cbStreak, 7); assert.equal(r.cbAt, true); assert.equal(r.cbEvent, true);
    assert.equal(r.cbLost, true);
    assert.equal(r.earned, 1); assert.equal(r.ms7, true); assert.equal(r.earnEvents, 1); assert.equal(r.capped, 2);
    assert.equal(r.repShields, 2); assert.equal(r.repBridged.length, 1); assert.equal(r.repCb, null); assert.deepEqual(r.repRest, [1, 2]); assert.deepEqual(r.repNotify, { on: false, time: '20:00' });
    // interfața: foaia „Seria ta” se deschide, zilele libere se aleg, limita de 2 e respectată
    await p.evaluate(() => { Ov.closeAll(); go('home'); });
    await p.click('[data-a="streak-open"]');
    await p.click('[data-a="rest-day"][data-v="0"]'); await p.click('[data-a="rest-day"][data-v="6"]'); await p.click('[data-a="rest-day"][data-v="5"]');
    assert.deepEqual(await p.evaluate(() => S.settings.restDays), [0, 6]);
    assert.deepEqual(errs, []);
  } finally { await b.close(); }
});
