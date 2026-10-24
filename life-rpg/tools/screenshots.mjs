// Capturi de ecran pentru pagina din App Store (generate din aplicația reală, cu un profil demonstrativ).
// Dimensiuni: 1320×2868 (iPhone 6.9") și 1206×2622 (iPhone 6.3", „Dynamic Island medium”, obligatoriu).
// Rulare: npm run build && npm run serve (alt terminal) && node tools/screenshots.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
const ROOT = path.resolve(import.meta.dirname, '..');
const APP = process.env.APP_URL || 'http://localhost:8080/';
const OUT = path.join(ROOT, 'store/screenshots');
const SIZES = [{ name: '6.9in-1320x2868', w: 440, h: 956 }, { name: '6.3in-1206x2622', w: 402, h: 874 }];
const NAMES = { ro: ['Ana', 'Mihai', 'Elena', 'Andrei'], en: ['Ana', 'Mike', 'Ellen', 'Andrew'], ru: ['Анна', 'Миша', 'Лена', 'Андрей'] };

async function demo(p, lang) {
  await p.evaluate(({ names }) => {
    const s = Val.defaultState(); const td = U.dateKey();
    s.meta.createdAt = Date.now() - 22 * 86400000;
    Object.assign(s.profile, { name: names[0], avatar: 'strateg', onboarded: true, goals: ['Business', 'Sport'], priorities: ['business', 'discipline'], dailyMinutes: 45 });
    const attrs = ['intelligence', 'physical', 'discipline', 'business', 'communication', 'independence'];
    for (let d = 20; d >= 1; d--) {
      if (d === 9) continue;
      const k = U.addDays(td, -d);
      for (let j = 0; j < 3; j++) {
        const t = TEMPLATES[(d * 3 + j) % TEMPLATES.length], a = attrs[(d + j) % 6], b = attrs[(d + j + 2) % 6], amt = 25 + ((d * 7 + j * 13) % 40), at = U.parseKey(k).getTime() + 3600000 * (9 + j * 3), cid = U.uid('cp');
        s.xpLog.push({ id: U.uid('tx'), key: 'demo:' + d + ':' + j, type: 'quest', amount: amt, dateKey: k, at, reason: t.title, refId: cid, attrs: { [a]: Math.round(amt * 0.7), [b]: amt - Math.round(amt * 0.7) }, meta: {} });
        s.completions.push({ id: cid, questId: 'q_demo' + d + j, title: t.title, category: t.category, kind: t.kind, difficulty: t.difficulty, at, dateKey: k, xp: amt, xpRequested: amt, note: 'Gata: am notat ce am făcut și ce am învățat din asta.', minutes: t.minutes, attrs: [a, b], flags: [] });
      }
    }
    s.streak.shields = 1;
    s.social.friends = names.slice(1).map((n, i) => ({ v: 1, id: 'pl_demo' + i, n, a: CFG.avatars[(i + 2) % CFG.avatars.length].id, lv: [9, 6, 4][i], xp: [3400, 2100, 1300][i], wk: [620, 410, 280][i], ws: U.weekStart(td), st: [15, 6, 3][i], bs: 20, q: 50, ac: 6, t: Date.now() - 3600000 * (i + 1), addedAt: Date.now() }));
    const r = Val.repair(s); S = r.state; Eng.rollover(S);
    for (const id of ['d_workout', 'd_project', 'd_reflect', 'm_product', 's_feedback']) {
      const t = TEMPLATES.find((x) => x.id === id); if (!t) continue;
      const c = Eng.sanitizeSuggestion(Eng.draftFromTemplate(t)); if (!c) continue;
      const a = Eng.addQuest(S, c, { source: 'template', templateId: t.id }); const q = a && (a.quest || a); if (q && q.id && t.category === 'daily') Eng.planAdd(S, q.id);
    }
    Eng.after(S); Eng.drain();
    Store.save(S); render({ nav: true });
  }, { names: NAMES[lang] });
}
const clean = (p) => p.evaluate(() => { document.querySelectorAll('#toasts > *, .toast').forEach((e) => e.remove()); Ov.closeAll(); });

const b = await chromium.launch();
for (const lang of ['ro', 'en', 'ru']) {
  for (const sz of SIZES) {
    const ctx = await b.newContext({ viewport: { width: sz.w, height: sz.h }, deviceScaleFactor: 3, serviceWorkers: 'block' });
    await ctx.addInitScript((l) => { try { if (!localStorage.getItem('__l')) { localStorage.setItem('lifeRpg.prefs.v1', JSON.stringify({ lang: l, motion: 'reduced' })); localStorage.setItem('__l', '1'); } } catch (e) { /* */ } }, lang);
    const p = await ctx.newPage();
    await p.goto(APP); await p.waitForTimeout(800);
    const dir = path.join(OUT, lang, sz.name); fs.mkdirSync(dir, { recursive: true });
    // 1. ecranul de bun venit
    await p.screenshot({ path: path.join(dir, '01-bun-venit.png') });
    await p.click('[data-a="ob-next"]').catch(() => {});
    await demo(p, lang); await p.waitForTimeout(400);
    // 2. acasă
    await p.evaluate(() => { S.settings.motion = 'reduced'; applyPrefs(); go('home'); }); await p.waitForTimeout(600); await clean(p);
    await p.screenshot({ path: path.join(dir, '02-acasa.png') });
    // 3. misiuni
    await p.evaluate(() => go('quests')); await p.waitForTimeout(500); await clean(p);
    await p.screenshot({ path: path.join(dir, '03-misiuni.png') });
    // 4. mentor (analiză locală)
    await p.evaluate(async () => { const r = await AI.ask(S, { intent: 'analyze', mode: 'local' }); Eng.addMessage(S, 'user', MENTOR_TXT.analyze || 'Analizează săptămâna', 'user'); Eng.addMessage(S, 'assistant', r.text, 'local'); commit(); go('mentor'); });
    await p.waitForTimeout(600); await clean(p); await p.evaluate(() => scrollLatest && scrollLatest(false));
    await p.screenshot({ path: path.join(dir, '04-mentor.png') });
    // 5. abilități
    await p.evaluate(() => go('skills')); await p.waitForTimeout(500); await clean(p);
    await p.screenshot({ path: path.join(dir, '05-abilitati.png') });
    // 6. clasament
    await p.evaluate(() => { UI.pgTab = 'lb'; go('progress'); }); await p.waitForTimeout(500); await clean(p);
    await p.screenshot({ path: path.join(dir, '06-clasament.png') });
    // 7. seria
    await p.evaluate(() => { go('home'); A['streak-open'](); }); await p.waitForTimeout(500);
    await p.evaluate(() => document.querySelectorAll('#toasts > *, .toast').forEach((e) => e.remove()));
    await p.screenshot({ path: path.join(dir, '07-seria.png') });
    await ctx.close();
    console.log('capturi', lang, sz.name);
  }
}
await b.close();
