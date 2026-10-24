#!/usr/bin/env node
/* Construiește jocul: app/src/index.html (text sursă în română) → build/index.html (RO/EN/RU).
   Pași: extrage scriptul → îl trece prin transformarea i18n (build.cjs) → unește traducerile (merge.cjs)
   → asamblează pagina finală cu dicționarul inclus → verifică sintaxa și traducerile lipsă.
   Utilizare: node tools/build-app.cjs [--out build/index.html] [--allow-untranslated] */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; };
const OUT = path.resolve(ROOT, opt('--out', 'build/index.html'));
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
const page = html.slice(0, a) + '\n' + head + js + html.slice(b);
fs.writeFileSync(OUT, page);
fs.writeFileSync(path.join(TMP, 'built.js'), head + js);
execFileSync(process.execPath, ['--check', path.join(TMP, 'built.js')]);
console.log('BUILD OK → ' + path.relative(ROOT, OUT) + ' (' + Math.round(page.length / 1024) + ' KB, ' + Object.keys(D).length + ' traduceri)');
