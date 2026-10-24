// Utilitare Playwright pentru testele aplicației (pagina construită în build/www, servită pe http://localhost:8080).
import { chromium } from 'playwright';
export const APP = process.env.APP_URL || 'http://localhost:8080/';
export async function start(opts = {}) {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: opts.sw ? 'allow' : 'block', ...(opts.ctx || {}) });
  if (opts.lang) await ctx.addInitScript((l) => { try { if (!localStorage.getItem('__langset')) { localStorage.setItem('lifeRpg.prefs.v1', JSON.stringify({ lang: l })); localStorage.setItem('__langset', '1'); } } catch (e) { /* */ } }, opts.lang);
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push('PAGEERR ' + e.message + ' @ ' + (e.stack || '').split('\n').slice(1, 3).join(' | ')));
  p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|ERR_INTERNET_DISCONNECTED|net::ERR/.test(m.text())) errs.push('console: ' + m.text()); });
  await p.goto(opts.url || APP); await p.waitForTimeout(700);
  return { b, ctx, p, errs };
}
export async function onboard(p, name) {
  await p.click('[data-a="ob-next"]'); await p.waitForTimeout(300);
  for (let step = 0; step < 12; step++) {
    if (await p.$('#nav:not([hidden])')) break;
    for (const inp of await p.$$('#view input[type=text],#view input:not([type]),#view textarea')) { if (await inp.isVisible() && !(await inp.inputValue())) await inp.fill(name || 'Test'); }
    for (const inp of await p.$$('#view input[type=number]')) { if (await inp.isVisible() && !(await inp.inputValue())) await inp.fill('25'); }
    const chips = await p.$$('#view button[data-a]:not([data-a^="ob-"])');
    const seen = new Set(); for (const c of chips) { const a = await c.getAttribute('data-a'); if (!seen.has(a) && await c.isVisible()) { seen.add(a); await c.click(); await p.waitForTimeout(60); } }
    const nx = await p.$('#view [data-a="ob-next"],#view [data-a="ob-done"],#view [data-a="ob-finish"]');
    if (!nx) break;
    await nx.click(); await p.waitForTimeout(300);
  }
}
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
