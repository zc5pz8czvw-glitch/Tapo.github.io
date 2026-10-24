/* plan de traducere pentru un șablon h`...`: împarte textul static în „fraze” (text vizibil sau atribute traductibile),
   fiecare frază putând conține valori ${...} ca {0}, {1}… Traducerea poate reordona valorile.
   Returnează { keys, plan(lookup) } — aceeași logică în pagină și în scriptul care extrage cheile. */
function i18nRuns(strings) {
  var TATTR = { placeholder: 1, title: 1, 'aria-label': 1, alt: 1 };
  var toks = []; /* {k:'s', v:str} sau {k:'v', i:index} */
  var st = 'text', quote = '', attr = '', attrBuf = '', curAttrT = false, depthRaw = '';
  var runs = []; var cur = null; var out = [];
  function startRun(kind) { cur = { kind: kind, parts: [] }; }
  function endRun() { if (cur) { out.push({ run: cur }); cur = null; } }
  function emitStatic(ch) { if (cur) cur.parts.push({ s: ch }); else out.push({ s: ch }); }
  for (var si = 0; si < strings.length; si++) {
    var str = strings[si];
    for (var p = 0; p < str.length; p++) {
      var c = str[p];
      if (st === 'text') {
        if (c === '<') {
          endRun();
          if (str.substr(p, 4) === '<!--') { st = 'comment'; out.push({ s: c }); continue; }
          st = 'tag'; attrBuf = ''; out.push({ s: c }); continue;
        }
        if (!cur) startRun('text');
        emitStatic(c);
      } else if (st === 'comment') {
        out.push({ s: c });
        if (c === '>' && str.substr(p - 2, 2) === '--') st = 'text';
      } else if (st === 'tag') {
        if (c === '"' || c === "'") {
          var m = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*$/.exec(attrBuf);
          attr = m ? m[1].toLowerCase() : ''; quote = c; st = 'attr';
          out.push({ s: c });
          if (TATTR[attr]) startRun('attr');
          continue;
        }
        if (c === '>') { st = 'text'; out.push({ s: c }); continue; }
        attrBuf += c; out.push({ s: c });
      } else if (st === 'attr') {
        if (c === quote) { endRun(); st = 'tag'; attrBuf = ''; out.push({ s: c }); continue; }
        emitStatic(c);
      }
    }
    if (si < strings.length - 1) {
      /* o valoare ${...} */
      var ctx = st === 'text' ? 'text' : (st === 'attr' && TATTR[attr] ? 'tattr' : 'raw');
      if (st === 'text' && !cur) startRun('text');
      if (cur && (st === 'text' || ctx === 'tattr')) cur.parts.push({ v: si, ctx: ctx });
      else out.push({ v: si, ctx: ctx });
    }
  }
  endRun();
  /* chei: text static cu {n} pentru valori; spațiile de la margini rămân în afara cheii */
  var keys = [];
  for (var k = 0; k < out.length; k++) {
    var r = out[k].run; if (!r) continue;
    var key = '', n = 0, vals = [];
    for (var j = 0; j < r.parts.length; j++) { var pt = r.parts[j]; if (pt.s !== undefined) key += pt.s; else { key += '{' + n + '}'; vals.push(pt); n++; } }
    var lead = /^\s*/.exec(key)[0], trail = /\s*$/.exec(key.slice(lead.length))[0];
    var core = key.slice(lead.length, key.length - trail.length).replace(/\s+/g, ' ');
    var letters = core.replace(/\{\d+\}/g, '').replace(/&[a-z#0-9]+;/gi, '');
    r.key = /[A-Za-zÀ-ɏͰ-ϿЀ-ӿ]{2,}/.test(letters) ? core : null;
    r.lead = lead; r.trail = trail; r.vals = vals;
    if (r.key) keys.push(r.key);
  }
  function plan(lookup) {
    var S = [''], V = [];
    function pushS(x) { S[S.length - 1] += x; }
    function pushV(v) { V.push(v); S.push(''); }
    for (var q = 0; q < out.length; q++) {
      var o = out[q];
      if (o.s !== undefined) { pushS(o.s); continue; }
      if (o.v !== undefined) { pushV({ i: o.v, ctx: o.ctx }); continue; }
      var r2 = o.run, tr = r2.key ? lookup(r2.key) : null;
      if (!tr) { for (var a = 0; a < r2.parts.length; a++) { var pp = r2.parts[a]; if (pp.s !== undefined) pushS(pp.s); else pushV({ i: pp.v, ctx: pp.ctx }); } continue; }
      if (r2.kind === 'attr') tr = tr.replace(/"/g, '&quot;');
      pushS(r2.lead);
      var re = /\{(\d+)\}/g, last = 0, mm;
      while ((mm = re.exec(tr))) { pushS(tr.slice(last, mm.index)); var vv = r2.vals[+mm[1]]; if (vv) pushV({ i: vv.v, ctx: vv.ctx }); last = re.lastIndex; }
      pushS(tr.slice(last)); pushS(r2.trail);
    }
    return { s: S, v: V };
  }
  return { keys: keys, plan: plan };
}
if (typeof module !== 'undefined') module.exports = i18nRuns;
