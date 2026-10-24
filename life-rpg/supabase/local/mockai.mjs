// Furnizor AI simulat, pentru teste fără costuri și fără rețea. Imită API-urile Anthropic, OpenAI și Gemini.
// Comportament controlat prin cuvinte din ultimul mesaj: __SLOW__ (35 s), __FAIL__ (500), __RATE__ (429), __OVERLOAD__ (529), __BADJSON__, __EMPTY__.
import http from 'node:http';
let calls = 0;
const lastUser = (msgs) => { const u = msgs.filter((m) => m.role === 'user').pop(); return typeof u?.content === 'string' ? u.content : JSON.stringify(u?.content ?? ''); };
const answer = (system, user) => {
  const lang = /LIMBA ENGLEZĂ/.test(system) ? 'en' : /LIMBA RUSĂ/.test(system) ? 'ru' : 'ro';
  if (/Răspunde DOAR cu JSON/.test(user)) {
    if (/__BADJSON__/.test(user)) return 'nu este json';
    return '```json\n' + JSON.stringify({ summary: 'mock summary ' + lang, suggestions: [
      { title: 'Mock ' + lang + ': citește 20 de pagini', desc: 'd', category: 'daily', kind: 'read', difficulty: 2, minutes: 20, attrs: ['intelligence'], criteria: 'c', steps: ['a', 'b'], why: 'w' },
      { title: 'Mock ' + lang + ': construiește un prototip', desc: 'd', category: 'main', kind: 'build', difficulty: 3, minutes: 45, attrs: ['business'], criteria: 'c', steps: ['a'], why: 'w' }] }) + '\n```';
  }
  if (/__EMPTY__/.test(user)) return '';
  return '### Mock (' + lang + ')\n- ' + user.slice(-60).replace(/\s+/g, ' ');
};
http.createServer((req, res) => {
  let b = ''; req.on('data', (c) => (b += c)); req.on('end', async () => {
    calls++;
    if (req.url === '/calls') { res.end(String(calls)); return; }
    let j = {}; try { j = JSON.parse(b || '{}'); } catch {}
    const msgs = j.messages || (j.contents || []).map((c) => ({ role: c.role, content: c.parts?.[0]?.text }));
    const sys = typeof j.system === 'string' ? j.system : Array.isArray(j.system) ? j.system.map((s) => s.text).join('') : (j.systemInstruction?.parts?.[0]?.text || (msgs.find((m) => m.role === 'system')?.content) || '');
    const u = lastUser(msgs);
    console.log(JSON.stringify({ url: req.url, model: j.model, max_tokens: j.max_tokens ?? j.max_completion_tokens, thinking: j.thinking, output_config: j.output_config, system_cache: Array.isArray(j.system) ? j.system.map((x) => x.cache_control) : undefined, roles: msgs.map((m) => m.role).join(','), headers: { v: req.headers['anthropic-version'], key: req.headers['x-api-key'] ? 'set' : undefined } }));
    const send = (st, o) => { res.writeHead(st, { 'content-type': 'application/json', 'request-id': 'req_mock' }); res.end(JSON.stringify(o)); };
    if (/__SLOW__/.test(u)) await new Promise((r) => setTimeout(r, 35000));
    if (/__FAIL__/.test(u)) return send(500, { type: 'error', error: { type: 'api_error', message: 'mock fail' } });
    if (/__RATE__/.test(u)) return send(429, { type: 'error', error: { type: 'rate_limit_error', message: 'mock rate' } });
    if (/__OVERLOAD__/.test(u)) return send(529, { type: 'error', error: { type: 'overloaded_error', message: 'mock overloaded' } });
    const text = answer(sys, u);
    if (req.url.startsWith('/v1/messages')) {
      if (j.model !== 'claude-haiku-5-5' && !process.env.ANY_MODEL) return send(400, { type: 'error', error: { type: 'invalid_request_error', message: 'unexpected model ' + j.model } });
      return send(200, { id: 'msg_mock', type: 'message', role: 'assistant', model: j.model, content: text ? [{ type: 'text', text }] : [], stop_reason: 'end_turn', stop_sequence: null,
        usage: { input_tokens: 1200, output_tokens: 80, cache_read_input_tokens: 300, cache_creation_input_tokens: 0 } });
    }
    if (req.url.startsWith('/v1/chat/completions')) return send(200, { choices: [{ message: { role: 'assistant', content: text }, finish_reason: 'stop' }], usage: { prompt_tokens: 1500, completion_tokens: 80 } });
    if (req.url.includes(':generateContent')) return send(200, { candidates: [{ content: { parts: [{ text }] }, finishReason: 'STOP' }], usageMetadata: { promptTokenCount: 1500, candidatesTokenCount: 80 } });
    send(404, { error: 'unknown ' + req.url });
  });
}).listen(8787, () => console.log('mock ai on 8787'));
