// Funcția server „mentor”: singurul drum prin care aplicația ajunge la un model AI.
//   1. verifică sesiunea utilizatorului (token Supabase) și că e-mailul este confirmat;
//   2. verifică acordul explicit pentru trimiterea datelor către furnizorul AI și că, contul nu e blocat;
//   3. rezervă o cerere din cota zilnică (per utilizator, per minut, buget global) — atomic, în baza de date;
//   4. construiește instrucțiunile pe server și apelează furnizorul (cheia API stă doar aici, ca secret);
//   5. dacă furnizorul eșuează, returnează cota și un cod de eroare clar; aplicația răspunde atunci cu mentorul local.
import { buildMessages, extractJson, JSON_INTENTS, maxTokensFor, parseRequest, systemPrompt } from "../_shared/prompt.ts";
import { complete, isConfigured, providerName, ProviderError } from "../_shared/providers.ts";

const env = (k: string, d = "") => Deno.env.get(k) ?? d;
const SUPABASE_URL = env("SUPABASE_URL").replace(/\/$/, "");
const ANON = env("SUPABASE_ANON_KEY");
const SERVICE = env("SUPABASE_SERVICE_ROLE_KEY");
const LIMITS = {
  free: Number(env("AI_DAILY_FREE", "15")),
  premium: Number(env("AI_DAILY_PREMIUM", "120")),
  perMinute: Number(env("AI_PER_MINUTE", "6")),
  globalDaily: Number(env("AI_GLOBAL_DAILY", "3000")),
  timeoutMs: Number(env("AI_TIMEOUT_MS", "25000")),
};
const ORIGINS = env("ALLOWED_ORIGINS", "*").split(",").map((s) => s.trim()).filter(Boolean);

function cors(req: Request): Record<string, string> {
  const o = req.headers.get("origin") || "";
  const allow = ORIGINS.includes("*") ? "*" : ORIGINS.includes(o) ? o : ORIGINS[0] || "null";
  return {
    "access-control-allow-origin": allow,
    "access-control-allow-headers": "authorization, apikey, content-type, x-client-info",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-max-age": "86400",
    vary: "origin",
  };
}
const reply = (req: Request, status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors(req), "content-type": "application/json; charset=utf-8" } });
const fail = (req: Request, status: number, code: string, extra: Record<string, unknown> = {}) => reply(req, status, { ok: false, code, ...extra });

async function sha(s: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(d)).slice(0, 6).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function log(o: Record<string, unknown>) { console.log(JSON.stringify({ fn: "mentor", t: new Date().toISOString(), ...o })); }

async function getUser(token: string) {
  const r = await fetch(SUPABASE_URL + "/auth/v1/user", { headers: { apikey: ANON, authorization: "Bearer " + token } });
  if (!r.ok) return null;
  return await r.json() as { id: string; email_confirmed_at?: string | null; is_anonymous?: boolean };
}
async function rest(path: string, init: RequestInit = {}) {
  const r = await fetch(SUPABASE_URL + "/rest/v1/" + path, {
    ...init,
    headers: { apikey: SERVICE, authorization: "Bearer " + SERVICE, "content-type": "application/json", ...(init.headers || {}) },
  });
  const txt = await r.text();
  if (!r.ok) throw new Error("rest " + path.split("?")[0] + " " + r.status + " " + txt.slice(0, 200));
  return txt ? JSON.parse(txt) : null;
}
const rpc = (fn: string, args: Record<string, unknown>) => rest("rpc/" + fn, { method: "POST", body: JSON.stringify(args) });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  if (req.method !== "POST") return fail(req, 405, "method_not_allowed");
  const t0 = Date.now();

  /* 1. sesiune */
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token || token === ANON) return fail(req, 401, "not_authenticated");
  let user;
  try { user = await getUser(token); } catch { return fail(req, 503, "unavailable"); }
  if (!user?.id) return fail(req, 401, "not_authenticated");
  if (env("AI_REQUIRE_CONFIRMED_EMAIL", "true") === "true" && !user.email_confirmed_at) return fail(req, 403, "email_not_confirmed");
  const who = await sha(user.id);

  /* corpul cererii: limită de mărime înainte de parsare */
  const raw = await req.text();
  if (raw.length > 64000) return fail(req, 413, "prompt_too_large");
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return fail(req, 400, "invalid_request"); }

  /* 2. profil: acord AI, blocare, plan */
  let prof: { ai_consent_at: string | null; disabled: boolean; plan: string; plan_until: string | null } | undefined;
  try {
    const rows = await rest("profiles?select=ai_consent_at,disabled,plan,plan_until&id=eq." + encodeURIComponent(user.id));
    prof = rows[0];
  } catch (e) { log({ who, err: String(e) }); return fail(req, 503, "unavailable"); }
  if (!prof) return fail(req, 401, "not_authenticated");
  if (prof.disabled) return fail(req, 403, "account_disabled");
  const premium = prof.plan === "premium" && (!prof.plan_until || Date.parse(prof.plan_until) > Date.now());
  const daily = premium ? LIMITS.premium : LIMITS.free;

  /* cerere de stare (fără apel AI): aplicația afișează câte mesaje mai ai */
  if ((body as { intent?: string })?.intent === "status") {
    let used = 0;
    try {
      const d = new Date().toISOString().slice(0, 10);
      const r = await rpc("ai_usage_of", { p_user: user.id, p_day: d }).catch(() => null);
      used = Number(r) || 0;
    } catch { /* ignorăm */ }
    return reply(req, 200, { ok: true, configured: isConfigured(), consent: !!prof.ai_consent_at, limit: daily, used, plan: premium ? "premium" : "free", provider: providerName() });
  }

  if (!prof.ai_consent_at) return fail(req, 403, "consent_required");
  if (!isConfigured()) { log({ who, code: "not_configured" }); return fail(req, 503, "not_configured"); }

  const r = parseRequest(body);
  if (typeof r === "string") return fail(req, 400, "invalid_request", { field: r });

  /* 3. cotă */
  let take: { ok: boolean; code?: string; left?: number; limit?: number };
  try { take = await rpc("ai_take", { p_user: user.id, p_daily: daily, p_per_minute: LIMITS.perMinute, p_global_daily: LIMITS.globalDaily }); }
  catch (e) { log({ who, err: String(e) }); return fail(req, 503, "unavailable"); }
  if (!take.ok) {
    log({ who, intent: r.intent, code: take.code });
    const st = take.code === "global_budget" ? 503 : 429;
    return fail(req, st, take.code || "rate_limited", { limit: daily });
  }

  /* 4. apel AI */
  let ok = false, tin = 0, tout = 0;
  try {
    const out = await complete({ system: systemPrompt(r.lang, r.feedback), messages: buildMessages(r), maxTokens: maxTokensFor(r.intent), timeoutMs: LIMITS.timeoutMs });
    tin = out.tokensIn; tout = out.tokensOut; ok = true;
    if (!out.text) { log({ who, intent: r.intent, code: "empty_completion", ms: Date.now() - t0 }); return fail(req, 502, "empty_completion", { left: take.left, limit: daily }); }
    if (JSON_INTENTS.includes(r.intent)) {
      const j = extractJson(out.text);
      if (!j || typeof j !== "object") { log({ who, intent: r.intent, code: "invalid_json", ms: Date.now() - t0 }); return fail(req, 502, "invalid_json", { left: take.left, limit: daily }); }
      log({ who, intent: r.intent, ms: Date.now() - t0, tin, tout });
      return reply(req, 200, { ok: true, json: j, truncated: out.stop === "max_tokens", left: take.left, limit: daily });
    }
    log({ who, intent: r.intent, ms: Date.now() - t0, tin, tout });
    return reply(req, 200, { ok: true, text: out.text.slice(0, 8000), truncated: out.stop === "max_tokens" || out.stop === "length", left: take.left, limit: daily });
  } catch (e) {
    const code = e instanceof ProviderError ? e.code : "upstream_error";
    log({ who, intent: r.intent, code, ms: Date.now() - t0, msg: String((e as Error)?.message || e).slice(0, 160) });
    const map: Record<string, [number, string]> = {
      rate_limited: [503, "upstream_busy"], overloaded: [503, "upstream_busy"], timeout: [504, "timeout"],
      refused: [422, "refused"], config: [503, "not_configured"], too_large: [413, "prompt_too_large"], upstream_error: [502, "upstream_error"],
    };
    const [st, c] = map[code] || [502, "upstream_error"];
    return fail(req, st, c, { left: (take.left ?? 0) + 1, limit: daily });
  } finally {
    try { await rpc("ai_finish", { p_user: user.id, p_ok: ok, p_tokens_in: tin, p_tokens_out: tout }); } catch (e) { log({ who, err: "finish " + String(e) }); }
  }
});
