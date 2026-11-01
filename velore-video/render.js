// Usage:
//   node render.js stills <outdir> t1 t2 ...       -> PNG stills at given times (s)
//   node render.js frames <outdir> <from> <to>     -> PNG frames [from,to) at 30 fps
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const FPS = 30;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.woff2': 'font/woff2', '.json': 'application/json' };

function serve() {
  return new Promise(res => {
    const srv = http.createServer((req, rsp) => {
      const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
      if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { rsp.writeHead(404); return rsp.end(); }
      rsp.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' });
      fs.createReadStream(p).pipe(rsp);
    });
    srv.listen(0, '127.0.0.1', () => res(srv));
  });
}

(async () => {
  const [mode, outdir, ...rest] = process.argv.slice(2);
  fs.mkdirSync(outdir, { recursive: true });
  const srv = await serve();
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.error('[page]', m.text()); });
  page.on('pageerror', e => console.error('[pageerror]', e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/scene.html`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 180000 });

  const shot = async (t, file) => {
    await page.evaluate(t => window.renderFrame(t), t);
    await page.screenshot({ path: file, type: 'png' });
  };
  const t0 = Date.now();
  if (mode === 'stills') {
    for (const s of rest) await shot(parseFloat(s), path.join(outdir, `still_${parseFloat(s).toFixed(2)}.png`));
  } else {
    const from = parseInt(rest[0]), to = parseInt(rest[1]);
    for (let f = from; f < to; f++) {
      await shot(f / FPS, path.join(outdir, `f_${String(f).padStart(4, '0')}.png`));
      if ((f - from) % 30 === 0) console.log(`frame ${f} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
    }
  }
  console.log(`done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  await browser.close(); srv.close();
})().catch(e => { console.error(e); process.exit(1); });
