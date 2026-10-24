// Utilitare pentru testele de backend (rulează pe stiva locală din supabase/local).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const here = path.dirname(fileURLToPath(import.meta.url));
const envFile = fs.readFileSync(path.join(here, '../../supabase/local/dev.env'), 'utf8');
export const ENV = Object.fromEntries(envFile.split('\n').filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
export const URL_API = process.env.SUPABASE_URL || 'http://localhost:54321';
export const MAIL = process.env.MAILPIT_URL || 'http://localhost:54324';
export const ANON = ENV.ANON_KEY;
export const SERVICE = ENV.SERVICE_ROLE_KEY;

export const client = () => createClient(URL_API, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
export const admin = () => createClient(URL_API, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });

export const uniq = (p = 'u') => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}@test.liferpg.local`;
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Așteaptă e-mailul pentru adresă și extrage codul de 6 cifre (după `after`, ca să nu luăm un cod vechi). */
export async function otpFor(email, after = 0, tries = 40) {
  for (let i = 0; i < tries; i++) {
    const r = await fetch(`${MAIL}/api/v1/search?query=${encodeURIComponent('to:' + email)}&limit=10`);
    const j = await r.json();
    const msgs = (j.messages || []).filter((m) => Date.parse(m.Created) >= after - 2000).sort((a, b) => Date.parse(b.Created) - Date.parse(a.Created));
    if (msgs.length) {
      const m = await (await fetch(`${MAIL}/api/v1/message/${msgs[0].ID}`)).json();
      const code = /(\d{6})/.exec((m.HTML || '').replace(/<[^>]+>/g, ' ') + ' ' + (m.Text || ''));
      if (code) return { code: code[1], subject: m.Subject, html: m.HTML };
    }
    await sleep(250);
  }
  throw new Error('niciun e-mail pentru ' + email);
}

/** Creează un cont confirmat (prin codul primit pe e-mail) și întoarce clientul autentificat. */
export async function newUser(name) {
  const email = uniq(name || 'u'), password = 'Parola-Test-123';
  const c = client();
  const t0 = Date.now();
  const { error } = await c.auth.signUp({ email, password });
  if (error) throw error;
  const { code } = await otpFor(email, t0);
  const v = await c.auth.verifyOtp({ email, token: code, type: 'signup' });
  if (v.error) throw v.error;
  const uid = v.data.user.id;
  return { c, email, password, uid, token: v.data.session.access_token };
}

export async function mentor(token, body) {
  const r = await fetch(`${URL_API}/functions/v1/mentor`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', apikey: ANON, ...(token ? { authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body),
  });
  let j = null; try { j = await r.json(); } catch { /* corp gol */ }
  return { status: r.status, body: j };
}

export const savePayload = (rev, hash, extra = {}) => ({
  p_expected_rev: null, p_rev: rev, p_enc: 'json', p_data: JSON.stringify({ profile: { name: 'X' }, n: rev }), p_bytes: 40,
  p_checksum: '0000abcd', p_hash: hash, p_schema: 1, p_device_id: 'dev1', p_save_count: 1, p_updated_at: Date.now(),
  p_summary: { name: 'X', level: 2, totalXp: 120 }, p_force: false, ...extra,
});
