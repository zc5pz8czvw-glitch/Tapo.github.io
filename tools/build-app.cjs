#!/usr/bin/env node
/* Construiește jocul: app/src/index.html (text sursă în română) → build/index.html (RO/EN/RU).
   Pași: extrage scriptul → îl trece prin transformarea i18n (build.cjs) → unește traducerile (merge.cjs)
   → asamblează pagina finală cu dicționarul inclus → verifică sintaxa și traducerile lipsă.
   Apoi inserează configurația (LIFE_RPG_CONFIG), biblioteca Supabase și politica de securitate (CSP),
   și copiază fișierele publice (manifest, service worker, iconițe, fonturi) lângă pagină.
   Utilizare: node tools/build-app.cjs [--config app/config.json] [--out build/www] [--allow-untranslated] */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; };
const OUT_DIR = path.resolve(ROOT, opt('--out', 'build/www'));
const OUT = path.join(OUT_DIR, 'index.html');
const CONFIG_FILE = path.resolve(ROOT, opt('--config', 'app/config.json'));
const PKG = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const ALLOW_UNTRANSLATED = args.includes('--allow-untranslated');
const SRC = path.join(ROOT, 'app/src/index.html');
const I18N = path.join(ROOT, 'app/i18n');
const TMP = path.join(ROOT, 'build/.tmp');
fs.mkdirSync(TMP, { recursive: true });
fs.mkdirSync(path.dirname(OUT), { recursive: true });

const html = fs.readFileSync(SRC, 'utf8');
const a = html.indexOf('<script>') + 8, b = html.lastIndexOf('</script>');
if (a < 8 || b < a) throw new Error('app/src/index.html: nu găsesc blocul <script>');
fs.writeFileSync(path.join(TMP, 'src.js'), html.slice(a, b));

const env = Object.assign({}, process.env, { I18N_DIR: I18N, KEYS_FILE: path.join(TMP, 'keys.json') });
const run = (script, argv) => execFileSync(process.execPath, [path.join(__dirname, script)].concat(argv || []), { env, cwd: ROOT, encoding: 'utf8' });
process.stdout.write(run('build.cjs', [path.join(TMP, 'src.js'), path.join(TMP, 'out.js'), path.join(TMP, 'keys.json')]));
const mergeLog = run('merge.cjs');
process.stdout.write(mergeLog.split('\n').filter((l) => /^(dict|current keys|PH|TAG|EMPTY)/.test(l)).map((l) => l.slice(0, 300)).join('\n') + '\n');
if (/^(PH|TAG|EMPTY) /m.test(mergeLog)) { console.error('EROARE: traduceri cu marcaje sau parametri greșiți (vezi mai sus).'); process.exit(1); }

/* textele fără litere (doar marcaj HTML) și cele din notranslate.json nu au nevoie de traducere */
const NOTR = new Set(JSON.parse(fs.readFileSync(path.join(I18N, 'notranslate.json'), 'utf8')));
const untranslated = JSON.parse(fs.readFileSync(path.join(TMP, 'untranslated.json'), 'utf8'))
  .filter((k) => !NOTR.has(k))
  .filter((k) => /\p{L}{2,}/u.test(k.replace(/<[^>]*>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\{\d+\}/g, ' ')));
if (untranslated.length) {
  console.error('Texte fără traducere EN/RU (' + untranslated.length + '):\n' + untranslated.map((k) => '  ' + JSON.stringify(k).slice(0, 160)).join('\n'));
  if (!ALLOW_UNTRANSLATED) { console.error('Adaugă-le într-un fișier app/i18n/kNNN.json: [["text ro","english","русский"], …]'); process.exit(1); }
}

const D = JSON.parse(fs.readFileSync(path.join(I18N, 'dict.json'), 'utf8'));
const P = JSON.parse(fs.readFileSync(path.join(I18N, 'pl.json'), 'utf8'));
const keys = JSON.parse(fs.readFileSync(path.join(TMP, 'keys.json'), 'utf8'));
const missingPl = keys.pl.map((x) => x.k).filter((k) => !P[k]);
if (missingPl.length) { console.error('Plurale fără traducere în app/i18n/pl.json: ' + JSON.stringify(missingPl)); if (!ALLOW_UNTRANSLATED) process.exit(1); }

const js = fs.readFileSync(path.join(TMP, 'out.js'), 'utf8');
const head = '/* ---- 00-i18n-dict ---- */\nconst I18N_DICT = ' + JSON.stringify(D) + ';\nconst I18N_PL = ' + JSON.stringify(P) + ';\n';
let page = html.slice(0, a) + '\n' + head + js + html.slice(b);

/* configurația (doar valori publice: URL-ul serverului și cheia publică „anon”, protejată de regulile RLS) */
const cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
for (const k of Object.keys(cfg)) if (/secret|service|private/i.test(k)) throw new Error('config: cheia „' + k + '” pare secretă; nu o pune în aplicație');
if (cfg.supabaseAnonKey) {
  try { const role = JSON.parse(Buffer.from(cfg.supabaseAnonKey.split('.')[1], 'base64url').toString()).role; if (role && role !== 'anon') throw new Error('supabaseAnonKey nu este cheia „anon” (rol: ' + role + '). Nu pune niciodată cheia service_role în aplicație.'); }
  catch (e) { if (/service_role|rol:/.test(e.message)) throw e; /* cheile noi „sb_publishable_…” nu sunt JWT */ }
  if (/^sb_secret_/.test(cfg.supabaseAnonKey)) throw new Error('supabaseAnonKey este o cheie secretă (sb_secret_…). Folosește cheia publicabilă.');
}
cfg.appVersion = PKG.version;
const vendor = fs.readFileSync(path.join(ROOT, 'app/vendor/supabase-2.117.3.js'), 'utf8');
if (/<\/script/i.test(vendor)) throw new Error('vendor conține </script>');
const boot = '<script>window.LIFE_RPG_CONFIG = ' + JSON.stringify(cfg).replace(/</g, '\\u003c') + ';</script>\n<script>' + vendor + '\n</script>';
if (!page.includes('<!--BOOT-->')) throw new Error('lipsește <!--BOOT--> în app/src/index.html');
page = page.replace('<!--BOOT-->', () => boot);

/* politica de securitate a conținutului: scripturi doar din pagină, conexiuni doar către serverul jocului */
const api = cfg.supabaseUrl ? new URL(cfg.supabaseUrl).origin : '';
const csp = ["default-src 'self'", "script-src 'self' 'unsafe-inline'", "style-src 'self' 'unsafe-inline'", "img-src 'self' data: blob:", "font-src 'self' data:",
  "connect-src 'self'" + (api ? ' ' + api : ''), "media-src 'self' data: blob:", "object-src 'none'", "base-uri 'self'", "form-action 'none'", "frame-src 'none'", "worker-src 'self'"].join('; ');
page = page.replace('<!--CSP-->', '<meta http-equiv="Content-Security-Policy" content="' + csp + '">');
fs.writeFileSync(OUT, page);

/* fișierele publice */
const copyDir = (from, to) => { fs.mkdirSync(to, { recursive: true }); for (const f of fs.readdirSync(from, { withFileTypes: true })) { const s1 = path.join(from, f.name), d1 = path.join(to, f.name); if (f.isDirectory()) copyDir(s1, d1); else fs.copyFileSync(s1, d1); } };
copyDir(path.join(ROOT, 'app/public'), OUT_DIR);
const fontSrc = path.join(ROOT, 'node_modules/@fontsource/montserrat/files');
fs.mkdirSync(path.join(OUT_DIR, 'fonts'), { recursive: true });
for (const w of [400, 500, 600, 700]) fs.copyFileSync(path.join(fontSrc, 'montserrat-cyrillic-' + w + '-normal.woff2'), path.join(OUT_DIR, 'fonts', 'montserrat-cyrillic-' + w + '.woff2'));
/* service worker: versiunea cache-ului = conținutul paginii (orice build nou invalidează cache-ul vechi) */
const crypto = require('crypto');
const swFile = path.join(OUT_DIR, 'sw.js');
if (fs.existsSync(swFile)) fs.writeFileSync(swFile, fs.readFileSync(swFile, 'utf8').replace('__BUILD_HASH__', crypto.createHash('sha256').update(page).digest('hex').slice(0, 12)));
fs.writeFileSync(path.join(TMP, 'built.js'), head + js);
execFileSync(process.execPath, ['--check', path.join(TMP, 'built.js')]);
console.log('BUILD OK → ' + path.relative(ROOT, OUT) + ' · config ' + path.relative(ROOT, CONFIG_FILE) + ' (' + Math.round(page.length / 1024) + ' KB, ' + Object.keys(D).length + ' traduceri)');
