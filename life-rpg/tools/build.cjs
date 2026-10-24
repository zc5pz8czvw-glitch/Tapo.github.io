// Transformă sursa: textele afișate (în română) trec prin $t(); extrage cheile de tradus.
// node build.cjs src.js out.js keys.json
const fs = require('fs');
const acorn = require('acorn');
const walk = require('acorn-walk');
const i18nRuns = require('./planner.js');
const [, , IN, OUT, KEYS] = process.argv;
const src = fs.readFileSync(IN, 'utf8');
const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'script', preserveParens: true });

/* ---------- regiuni excluse ---------- */
const excl = [];
const i0 = src.indexOf('/* ---- 00-i18n.js ---- */'), i1 = src.indexOf('/* ---- 00-icons.gen.js ---- */');
excl.push([i0, i1]);
const iconsEnd = src.indexOf('\n', src.indexOf('const ICONS = ')); excl.push([i1, iconsEnd]);
const AI_EXCL = new Set(['context', 'RULES', 'AI_LANG', 'KINDS_LIST', 'ATTRS_LIST', 'SUG_SHAPE', 'SUG_RULES', 'taskFor', 'buildMessages', 'fbStyle']);
walk.full(ast, (n) => {
  if (n.type === 'VariableDeclarator' && n.id.type === 'Identifier' && AI_EXCL.has(n.id.name)) excl.push([n.start, n.end]);
  if (n.type === 'FunctionDeclaration' && n.id && AI_EXCL.has(n.id.name)) excl.push([n.start, n.end]);
  if (n.type === 'CallExpression' && n.callee.type === 'MemberExpression' && n.callee.object.name === 'console') excl.push([n.start, n.end]);
});
const isExcl = (n) => excl.some(([a, b]) => n.start >= a && n.end <= b);

/* ---------- clasificare ---------- */
const DENY = new Set(['Escape', 'Enter', 'Tab', 'Poppins', 'Montserrat', 'LIFE RPG', 'LIFE_RPG', 'AbortError']);
const ALLOW_LOWER = new Set([' caractere', ' de ', ' deblocate', ' din ', ' etape', ' la ', ' min', ' proiect', ' proiecte', ' zi', ' zile', 'acum ', 'azi', 'cod', 'cuvinte', 'ieri', 'live', 'minut', 'minute', 'misiune', 'misiuni', 'nivel', 'niveluri', 'obiectiv', 'obiective', 'ori', 'pagini', 'pas', 'peste ', 'sarcini', 'sesiune', 'sesiuni', 'sugestie', 'sugestii', 'termen ', 'terminat', 'tu', 'zilnic', 'echilibrat', 'intens', 'serios', 'eroare', 'parțial', 'live + cod']);
const CODE_KEYS = new Set(['id', 'icon', 'color', 'c1', 'c2', 'kind', 'category', 'branch', 'attr', 'type', 'code', 'key', 'tag', 'cls', 'to', 'src', 'status', 'vb', 'd', 'k', 'tpl', 'templateId', 'rgb', 'tone', 'intent', 'mode', 'role', 'source', 'origin', 'result', 'outcome', 'skin', 'motion', 'enc', 'slot', 'app', 'unitId', 'frame', 'deviceId', 'holder', 'filename', 'contentType', 'modelTier', 'tier', 'tierFast', 'version', 'schema', 'manifestDoc', 'partPrefix', 'lang', 'num']);
const strip = (s) => s.replace(/<[^>]*>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ');
const DIAC = /[ăâîșțşţĂÂÎȘȚŞŢ]/;
/* vocabular românesc: cuvintele din textele deja găsite, fără cele care există și în traducerile englezești (Focus, Boss, Reality…) */
const VOCAB = (() => {
  const v = new Set(); const en = new Set();
  try {
    const K = require(require('path').join(process.env.I18N_DIR, 'keys_v1.json')).keys, D = require(require('path').join(process.env.I18N_DIR, 'dict.json'));
    for (const k of K) for (const w of k.k.toLowerCase().replace(/<[^>]*>/g, ' ').match(/[a-zăâîșț]{3,}/g) || []) v.add(w);
    for (const k of Object.keys(D)) for (const w of (D[k][0] || '').toLowerCase().match(/[a-z]{3,}/g) || []) en.add(w);
  } catch (e) { /* prima rulare */ }
  for (const w of en) v.delete(w);
  return v;
})();
const codeLike = (s) => /[;{}=]|^[#.\[]|var\(|rgb\(|^[a-z-]+:\S|^\s*<[a-z]|^[a-z0-9_-]+$/.test(s.trim());
const ALLOW_EXTRA = new Set(['2 minute, +', 'localStorage (IndexedDB nu este disponibil)', '15 min', '30 min', 'chiar acum', 'termen azi', 'duplicat recent', ' caractere minim', ' <span class="chip c-green" style="padding:1px 7px;font-size:10.5px">mai nou</span>']);
function isDisplay(s) {
  if (DENY.has(s)) return false;
  if (ALLOW_EXTRA.has(s)) return true;
  if (ALLOW_LOWER.has(s)) return true;
  const t = strip(s).trim();
  if (!/\p{L}{2,}/u.test(t)) return false;
  const md = /^#{1,6}\s/.test(t);
  if (!md && /^[\w.:#\[\]=\-"' >*,()]+$/.test(t) && /[#\[\]=]|^\.|-\w+-|^[a-z]+[A-Z]/.test(t) && !DIAC.test(t)) return false; // selectoare / cod
  if (DIAC.test(t)) return true;
  if (/\p{L}{2,}[,.!?;:]?\s+\p{L}/u.test(t)) {
    if (/^[a-z]+(-[a-z]+)*(\s+[a-z]+(-[a-z]+)*)+$/.test(t) && !/\b(de|la|din|cu|și|si|pe|în|nu|ai|ești|este|sau)\b/.test(t)) return 'maybe';
    return true;
  }
  if (/^[A-ZĂÂÎȘȚ][a-zăâîșț]+[.!?…:]?$/.test(t)) return true;
  if ((md || !codeLike(s)) && (t.toLowerCase().match(/[a-zăâîșț]{3,}/g) || []).some((w) => VOCAB.has(w))) return true;
  return false;
}

/* ---------- utilitare ---------- */
const keys = new Map(); // cheie -> {ctx, kind}
const lineOf = (pos) => src.slice(src.lastIndexOf('\n', pos) + 1, src.indexOf('\n', pos)).trim().slice(0, 160);
const addKey = (k, pos, kind) => { if (!keys.has(k)) keys.set(k, { ctx: lineOf(pos), kind, pos }); };
const plPairs = new Map();
const maybe = [];

const edits = []; // {start, end, build}
const consumed = new Set();
const isStrLit = (n) => n && n.type === 'Literal' && typeof n.value === 'string';
const isTpl = (n) => n && n.type === 'TemplateLiteral';

function flattenPlus(n) {
  if (n.type === 'BinaryExpression' && n.operator === '+') return flattenPlus(n.left).concat([n.right]);
  return [n];
}
function textOf(a, b) {
  // aplică editările conținute în [a,b)
  const inner = edits.filter((e) => e.start >= a && e.end <= b).sort((x, y) => x.start - y.start);
  const top = []; let last = -1;
  for (const e of inner) { if (e.start >= last) { top.push(e); last = e.end; } }
  let out = '', p = a;
  for (const e of top) { out += src.slice(p, e.start) + e.build(); p = e.end; }
  return out + src.slice(p, b);
}
const q = (s) => JSON.stringify(s);

walk.fullAncestor(ast, (node, anc) => {
  if (isExcl(node)) return;
  const parent = anc[anc.length - 2];
  /* plural */
  if (node.type === 'CallExpression' && node.callee.type === 'MemberExpression' && node.callee.object.name === 'U' && node.callee.property.name === 'pl' && node.arguments.length === 3) {
    const [, a, b] = node.arguments;
    if (isStrLit(a) && isStrLit(b)) { plPairs.set(a.value + '|' + b.value, lineOf(node.start)); consumed.add(a); consumed.add(b); }
  }
  /* șabloane h`` */
  if (node.type === 'TaggedTemplateExpression' && node.tag.type === 'Identifier' && node.tag.name === 'h') {
    const strs = node.quasi.quasis.map((x) => x.value.cooked);
    for (const k of i18nRuns(strs).keys) addKey(k, node.start, 'h');
  }
});

/* lanțuri de concatenare (mai întâi, ca să marcăm literalii consumați) */
walk.fullAncestor(ast, (node, anc) => {
  if (isExcl(node)) return;
  if (node.type !== 'BinaryExpression' || node.operator !== '+') return;
  const parent = anc[anc.length - 2];
  if (parent && parent.type === 'BinaryExpression' && parent.operator === '+' && parent.left === node) return; // doar rădăcina lanțului
  const ops = flattenPlus(node);
  const first = ops.findIndex((o) => isStrLit(o) || isTpl(o));
  if (first < 0) return;
  const hasDisp = ops.slice(first).some((o) => (isStrLit(o) && isDisplay(o.value) === true) || (isTpl(o) && o.quasis.some((x) => isDisplay(x.value.cooked) === true)));
  if (!hasDisp) return;
  // format + argumente
  let fmt = ''; const args = [];
  if (first > 0) { fmt += '{0}'; args.push({ a: ops[0].start, b: ops[first - 1].end, paren: true }); }
  for (const o of ops.slice(first)) {
    if (isStrLit(o)) { fmt += o.value; consumed.add(o); }
    else if (isTpl(o)) {
      o.quasis.forEach((x, i) => { fmt += x.value.cooked; if (i < o.expressions.length) { fmt += '{' + args.length + '}'; args.push({ a: o.expressions[i].start, b: o.expressions[i].end }); } });
      consumed.add(o);
    } else { fmt += '{' + args.length + '}'; args.push({ a: o.start, b: o.end }); }
  }
  if (/\{\d+\}/.test(ops.filter(isStrLit).map((o) => o.value).join(''))) throw new Error('literal conține {n}: ' + lineOf(node.start));
  addKey(fmt, node.start, 't');
  edits.push({ start: node.start, end: node.end, build: () => '$t(' + q(fmt) + (args.length ? ', ' + args.map((x) => (x.paren ? '(' + textOf(x.a, x.b) + ')' : textOf(x.a, x.b))).join(', ') : '') + ')' });
});

/* literali și șabloane simple rămase */
walk.fullAncestor(ast, (node, anc) => {
  if (isExcl(node) || consumed.has(node)) return;
  const parent = anc[anc.length - 2];
  if (isStrLit(node)) {
    if (parent && parent.type === 'Property' && parent.key === node && !parent.computed) return;
    if (parent && parent.type === 'Property' && parent.value === node && parent.key && CODE_KEYS.has(parent.key.name || parent.key.value)) return;
    if (parent && parent.type === 'SwitchCase') return;
    if (parent && parent.type === 'MemberExpression' && parent.property === node) return;
    const d = isDisplay(node.value);
    if (d === 'maybe') { maybe.push(node.value + '   <<' + lineOf(node.start)); return; }
    if (d !== true) return;
    addKey(node.value, node.start, 't');
    edits.push({ start: node.start, end: node.end, build: () => '$t(' + src.slice(node.start, node.end) + ')' });
  } else if (isTpl(node) && !(parent && parent.type === 'TaggedTemplateExpression')) {
    if (!node.quasis.some((x) => isDisplay(x.value.cooked) === true)) return;
    let fmt = ''; const args = [];
    node.quasis.forEach((x, i) => { fmt += x.value.cooked; if (i < node.expressions.length) { fmt += '{' + i + '}'; args.push(node.expressions[i]); } });
    addKey(fmt, node.start, 't');
    edits.push({ start: node.start, end: node.end, build: () => '$t(' + q(fmt) + (args.length ? ', ' + args.map((e) => textOf(e.start, e.end)).join(', ') : '') + ')' });
  }
});

const out = textOf(0, src.length);
fs.writeFileSync(OUT, out);
const list = Array.from(keys.entries()).sort((a, b) => a[1].pos - b[1].pos).map(([k, v]) => ({ k, ctx: v.ctx, kind: v.kind }));
fs.writeFileSync(KEYS, JSON.stringify({ keys: list, pl: Array.from(plPairs.entries()).map(([k, c]) => ({ k, ctx: c })), maybe }, null, 1));
console.log('keys', list.length, 'h', list.filter((x) => x.kind === 'h').length, 't', list.filter((x) => x.kind === 't').length, 'pl', plPairs.size, 'maybe', maybe.length, 'edits', edits.length);
