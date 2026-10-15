// Browser tests for the Zakon Barbershop single-page site.
// Run: npm test   (needs Playwright + Chromium; set PW_CHROMIUM=/path/to/chrome to use a custom binary)
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = path.join(__dirname, '..');
const BASE_PATH = '/tapo.github.io/'; // GitHub Pages project sites live under a sub-path

function serve() {
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      const u = decodeURIComponent(req.url.split('?')[0]);
      if (!u.startsWith(BASE_PATH)) { res.writeHead(404); return res.end('not found'); }
      let rel = u.slice(BASE_PATH.length) || 'index.html';
      const f = path.join(ROOT, rel);
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('not found'); }
      res.writeHead(200, { 'Content-Type': f.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream' });
      fs.createReadStream(f).pipe(res);
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}

const results = [];
async function test(name, fn) {
  try { await fn(); results.push([true, name]); console.log('  ok   ' + name); }
  catch (e) { results.push([false, name]); console.log('  FAIL ' + name + '\n       ' + e.message); }
}

(async () => {
  const srv = await serve();
  const url = `http://127.0.0.1:${srv.address().port}${BASE_PATH}`;
  const fileUrl = 'file://' + path.join(ROOT, 'index.html');
  const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});

  async function open(target, opts = {}) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, ...opts });
    // Third-party fonts are not needed for these checks; keep runs deterministic/offline.
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    page.on('console', m => {
      const t = m.text();
      if (m.type() === 'error' && !/fonts\.(googleapis|gstatic)|net::ERR_FAILED/.test(t)) errors.push('console: ' + t);
      if (/Content Security Policy/i.test(t)) errors.push('csp: ' + t);
    });
    page.on('requestfailed', r => { if (!/fonts\.(googleapis|gstatic)/.test(r.url())) errors.push('requestfailed: ' + r.url()); });
    await page.goto(target);
    return { ctx, page, errors };
  }
  const hiddenRv = page => page.evaluate(() =>
    [...document.querySelectorAll('.rv')].filter(e => parseFloat(getComputedStyle(e).opacity) < 0.99).length);
  async function scrollAll(page) {
    await page.evaluate(async () => {
      for (let y = 0; y <= document.body.scrollHeight; y += 300) { window.scrollTo({ top: y, behavior: 'instant' }); await new Promise(r => setTimeout(r, 40)); }
    });
    await page.waitForTimeout(1200);
  }
  // the site uses smooth scrolling: wait until the target section has arrived and scrolling stopped
  async function settle(page, id) {
    let last = null, same = 0;
    for (let i = 0; i < 60 && same < 3; i++) {
      await page.waitForTimeout(150);
      const top = await page.evaluate(id => Math.round(document.getElementById(id).getBoundingClientRect().top), id);
      same = (top === last && Math.abs(top) <= 40) ? same + 1 : 0;
      last = top;
    }
    await page.waitForTimeout(1200); // reveal transition is .9s
  }

  console.log('Zakon Barbershop — browser tests');

  for (const [label, target] of [['http (GitHub Pages sub-path)', url], ['file:// (opened as a file)', fileUrl]]) {
    await test(`[${label}] without JavaScript every section is visible`, async () => {
      const { ctx, page } = await open(target, { javaScriptEnabled: false });
      await page.waitForTimeout(2500); // hero entrance animations finish at 1.75s
      assert.strictEqual(await hiddenRv(page), 0, 'some .rv blocks are invisible');
      for (const sel of ['.hero h1 .ln>span', '.hero p.lead', '.hero-cta', '.hero-facts']) {
        const op = await page.$eval(sel, e => getComputedStyle(e).opacity);
        assert.strictEqual(op, '1', sel + ' opacity ' + op);
      }
      const hrefs = await page.$$eval('[data-book]', a => a.map(x => x.getAttribute('href')));
      assert.ok(hrefs.length === 4 && hrefs.every(h => h === '#filiale'), 'booking links need a fallback href');
      await ctx.close();
    });

    await test(`[${label}] with JavaScript: no errors, no CSP violations, all sections reveal on scroll`, async () => {
      const { ctx, page, errors } = await open(target);
      assert.ok(await page.evaluate(() => document.documentElement.classList.contains('js')));
      await scrollAll(page);
      assert.strictEqual(await hiddenRv(page), 0);
      assert.deepStrictEqual(errors, []);
      await ctx.close();
    });
  }

  for (const id of ['top', 'servicii', 'echipa', 'filiale', 'recenzii']) {
    await test(`direct link /#${id} shows its content (fresh load and reload)`, async () => {
      const { ctx, page, errors } = await open(url + '#' + id);
      for (let i = 0; i < 2; i++) {
        if (i) await page.reload();
        await settle(page, id);
        const vis = await page.evaluate(id => {
          const sec = document.getElementById(id);
          const r = sec.getBoundingClientRect();
          const inView = [...sec.querySelectorAll('.rv')].filter(e => { const b = e.getBoundingClientRect(); return b.top < innerHeight - 60 && b.bottom > 0; });
          return { top: Math.round(r.top), hidden: inView.filter(e => parseFloat(getComputedStyle(e).opacity) < 0.99).length, count: inView.length };
        }, id);
        // on reload Chrome restores the old scroll offset (can differ by the 32px reveal offset);
        // sections have 88–120px top padding, so the content is still fully in view
        assert.ok(Math.abs(vis.top) <= 40, 'section not scrolled into view: ' + vis.top);
        assert.strictEqual(vis.hidden, 0, 'visible area still blank');
      }
      assert.deepStrictEqual(errors, []);
      await ctx.close();
    });
  }

  await test('booking: every "Programează-te" opens the branch picker; Esc closes and restores focus', async () => {
    const { ctx, page, errors } = await open(url);
    const n = await page.locator('[data-book]').count();
    for (let i = 0; i < n; i++) {
      const btn = page.locator('[data-book]').nth(i);
      if (!(await btn.isVisible())) continue;
      await btn.scrollIntoViewIfNeeded();
      await btn.click();
      await page.waitForTimeout(500);
      assert.ok(await page.$eval('#modal', m => m.classList.contains('on') && m.getAttribute('aria-hidden') === 'false'));
      assert.ok(await page.evaluate(() => document.activeElement.classList.contains('pick')), 'focus not moved into dialog');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
      assert.ok(await page.$eval('#modal', m => !m.classList.contains('on')));
    }
    // keyboard-only: Tab to header booking button and press Enter
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.focus('header [data-book]');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);
    assert.ok(await page.$eval('#modal', m => m.classList.contains('on')));
    // focus stays trapped inside the dialog
    for (let i = 0; i < 6; i++) await page.keyboard.press('Tab');
    assert.ok(await page.evaluate(() => document.getElementById('modal').contains(document.activeElement)));
    await page.click('.x');
    await page.waitForTimeout(400);
    assert.ok(await page.evaluate(() => document.activeElement.matches('header [data-book]')), 'focus not restored');
    const picks = await page.$$eval('.pick', a => a.map(x => [x.href, x.target, x.rel]));
    assert.strictEqual(picks.length, 2);
    for (const [h, t, r] of picks) { assert.ok(h.startsWith('https://www.fresha.com/')); assert.strictEqual(t, '_blank'); assert.ok(r.includes('noopener')); }
    assert.deepStrictEqual(errors, []);
    await ctx.close();
  });

  await test('mobile (390px): burger menu opens/closes, links navigate, no horizontal scroll', async () => {
    const { ctx, page, errors } = await open(url, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    assert.strictEqual(await page.getAttribute('#burger', 'aria-expanded'), 'false');
    assert.strictEqual(await page.$eval('#mnav', e => getComputedStyle(e).visibility), 'hidden');
    await page.click('#burger');
    await page.waitForTimeout(700);
    assert.strictEqual(await page.getAttribute('#burger', 'aria-expanded'), 'true');
    await page.click('#mnav a[href="#echipa"]');
    await page.waitForTimeout(1500);
    assert.strictEqual(await page.getAttribute('#burger', 'aria-expanded'), 'false');
    assert.ok(page.url().endsWith('#echipa'));
    await page.click('#burger'); await page.waitForTimeout(700);
    await page.click('#mnav [data-book]'); await page.waitForTimeout(500);
    assert.ok(await page.$eval('#modal', m => m.classList.contains('on')));
    assert.ok(await page.$eval('#mnav', m => !m.classList.contains('on')));
    assert.deepStrictEqual(errors, []);
    await ctx.close();
  });

  for (const w of [320, 360, 414, 768, 1024, 1440]) {
    await test(`layout at ${w}px has no horizontal overflow`, async () => {
      const { ctx, page } = await open(url, { viewport: { width: w, height: 800 } });
      const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      assert.ok(over <= 0, 'overflow ' + over + 'px');
      await ctx.close();
    });
  }

  await test('"open now" status is filled in for both branches', async () => {
    const { ctx, page } = await open(url);
    const t = await page.$$eval('[data-open] span', s => s.map(x => x.textContent));
    assert.strictEqual(t.length, 2);
    assert.ok(t.every(x => /^(Deschis până la 20:00|Închis · deschidem la 10:00)$/.test(x)), t.join('|'));
    await ctx.close();
  });

  await test('all images decode and every link has a valid target', async () => {
    const { ctx, page } = await open(url);
    const bad = await page.$$eval('img', i => i.filter(x => !x.complete || x.naturalWidth === 0).length);
    assert.strictEqual(bad, 0);
    const links = await page.$$eval('a', a => a.map(x => x.getAttribute('href')));
    for (const h of links) {
      assert.ok(h, 'link without href');
      if (h.startsWith('#')) assert.ok(h === '#top' || (await page.$(h)), 'missing anchor ' + h);
      else assert.ok(/^(https:\/\/|tel:\+373\d{8}$)/.test(h), 'unexpected link ' + h);
    }
    const blank = await page.$$eval('a[target=_blank]', a => a.filter(x => !/noopener/.test(x.rel)).length);
    assert.strictEqual(blank, 0, 'target=_blank without rel=noopener');
    await ctx.close();
  });

  await browser.close();
  srv.close();
  const failed = results.filter(r => !r[0]).length;
  console.log(`\n${results.length - failed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
