// Poartă locală (echivalentul gateway-ului Supabase): /auth/v1 → auth, /rest/v1 → rest, /functions/v1 → functions.
import http from 'node:http';
import fs from 'node:fs';
const routes = [['/auth/v1', 'http://auth:9999'], ['/rest/v1', 'http://rest:3000'], ['/functions/v1', 'http://functions:9000']];
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info, x-supabase-api-version, prefer, accept-profile, content-profile, range',
  'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'access-control-expose-headers': 'content-range, sb-error-code',
};
http.createServer((req, res) => {
  if (req.method === 'OPTIONS') { res.writeHead(204, CORS); return res.end(); }
  if (req.url.startsWith('/templates/')) {
    const f = '/app/templates/' + req.url.slice(11).replace(/[^a-z_.]/g, '');
    try { const b = fs.readFileSync(f); res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(b); } catch { res.writeHead(404); return res.end(); }
  }
  const r = routes.find(([p]) => req.url === p || req.url.startsWith(p + '/') || req.url.startsWith(p + '?'));
  if (!r) { res.writeHead(404, CORS); return res.end('{"error":"not found"}'); }
  const target = new URL(r[1] + (req.url.slice(r[0].length) || '/'));
  const headers = { ...req.headers, host: target.host };
  const up = http.request(target, { method: req.method, headers }, (ur) => {
    const h = { ...ur.headers, ...CORS };
    res.writeHead(ur.statusCode || 502, h);
    ur.pipe(res);
  });
  up.on('error', (e) => { res.writeHead(502, CORS); res.end(JSON.stringify({ error: 'gateway', message: e.message })); });
  req.pipe(up);
}).listen(8000, () => console.log('gateway on 8000'));
