// Construiește site-ul public (GitHub Pages): jocul (build/www) + politica de confidențialitate, termenii și pagina de suport.
// Valorile din app/site/site.json înlocuiesc {{cheie}} în pagini. Câmpurile goale apar ca „[de completat]”, ca să se vadă clar.
import fs from 'node:fs';
import path from 'node:path';
const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'build/site'), WWW = path.join(ROOT, 'build/www'), SITE = path.join(ROOT, 'app/site');
if (!fs.existsSync(path.join(WWW, 'index.html'))) { console.error('Rulează întâi: npm run build'); process.exit(1); }
fs.rmSync(OUT, { recursive: true, force: true });
fs.cpSync(WWW, OUT, { recursive: true });
const cfg = JSON.parse(fs.readFileSync(path.join(SITE, 'site.json'), 'utf8'));
if (process.env.LIFE_RPG_SUPPORT_EMAIL && !cfg.contactEmail) cfg.contactEmail = process.env.LIFE_RPG_SUPPORT_EMAIL;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let missing = new Set();
for (const f of fs.readdirSync(SITE)) {
  if (f === 'site.json') continue;
  let t = fs.readFileSync(path.join(SITE, f), 'utf8');
  if (f.endsWith('.html')) t = t.replace(/\{\{(\w+)\}\}/g, (_, k) => { if (!cfg[k]) { missing.add(k); return '[de completat: ' + k + ']'; } return esc(cfg[k]); });
  fs.writeFileSync(path.join(OUT, f), t);
}
fs.writeFileSync(path.join(OUT, '.nojekyll'), '');
console.log('SITE OK → build/site' + (missing.size ? ' · ATENȚIE: completează în app/site/site.json: ' + [...missing].join(', ') : ''));
