// Furnizori AI interschimbabili. Alegerea se face din variabila de mediu AI_PROVIDER (fără modificări de cod):
//   anthropic (implicit) — Claude prin API-ul Anthropic, cu cheia ta de dezvoltator (ANTHROPIC_API_KEY)
//   openai               — orice API compatibil OpenAI Chat Completions (OpenAI, Mistral, Groq, DeepSeek…): OPENAI_API_KEY + OPENAI_BASE_URL
//   gemini               — Google Gemini API (GEMINI_API_KEY)
// Toți furnizorii întorc același rezultat ({text, tokensIn, tokensOut}) sau aruncă ProviderError cu un cod stabil.
import Anthropic from "npm:@anthropic-ai/sdk@0.132.1";

export interface Completion { text: string; tokensIn: number; tokensOut: number; stop?: string }
export interface CallArgs { system: string; messages: { role: "user" | "assistant"; content: string }[]; maxTokens: number; timeoutMs: number }

export class ProviderError extends Error {
  constructor(public code: "rate_limited" | "overloaded" | "timeout" | "upstream_error" | "refused" | "config" | "too_large", message: string, public status = 0) {
    super(message);
  }
}

const env = (k: string, d = "") => Deno.env.get(k) ?? d;

/* ---------------- Anthropic (SDK oficial) ---------------- */
let anthropic: Anthropic | null = null;
async function callAnthropic(a: CallArgs): Promise<Completion> {
  const key = env("ANTHROPIC_API_KEY");
  if (!key) throw new ProviderError("config", "ANTHROPIC_API_KEY lipsește");
  // fără reîncercări automate în SDK: le controlăm noi în complete(), ca timpul total să rămână sub limită
  anthropic ??= new Anthropic({ apiKey: key, baseURL: env("ANTHROPIC_BASE_URL") || undefined, maxRetries: 0 });
  const model = env("AI_MODEL", "claude-haiku-5-5");
  try {
    const r = await anthropic.messages.create({
      model,
      max_tokens: a.maxTokens,
      // promptul de sistem e identic pentru toți utilizatorii cu aceeași limbă/stil: îl punem în cache
      system: [{ type: "text", text: a.system, cache_control: { type: "ephemeral" } }],
      messages: a.messages,
      // răspunsuri scurte, de mentor: fără gândire extinsă (mai rapid și mai ieftin); configurabil
      ...(env("AI_THINKING", "off") === "off" ? { thinking: { type: "disabled" } } : {}),
      output_config: { effort: env("AI_EFFORT", "low") },
    } as Anthropic.MessageCreateParamsNonStreaming, { timeout: a.timeoutMs });
    if (r.stop_reason === "refusal") throw new ProviderError("refused", "refuz");
    const text = r.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
    const u = r.usage;
    return {
      text,
      tokensIn: (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0),
      tokensOut: u.output_tokens || 0,
      stop: r.stop_reason ?? undefined,
    };
  } catch (e) {
    if (e instanceof ProviderError) throw e;
    if (e instanceof Anthropic.RateLimitError) throw new ProviderError("rate_limited", "limită furnizor", 429);
    if (e instanceof Anthropic.APIConnectionTimeoutError) throw new ProviderError("timeout", "timeout");
    if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) throw new ProviderError("config", "cheie API invalidă", 401);
    if (e instanceof Anthropic.BadRequestError) {
      const msg = String((e as Error).message || "");
      throw new ProviderError(/too long|too large|prompt is too long/i.test(msg) ? "too_large" : "upstream_error", msg.slice(0, 200), 400);
    }
    if (e instanceof Anthropic.APIError) {
      const st = (e as { status?: number }).status ?? 0;
      throw new ProviderError(st === 529 ? "overloaded" : "upstream_error", "eroare furnizor " + st, st);
    }
    throw new ProviderError("upstream_error", String((e as Error)?.message || e).slice(0, 200));
  }
}

/* ---------------- fetch cu timeout (pentru ceilalți furnizori) ---------------- */
async function postJson(url: string, headers: Record<string, string>, body: unknown, timeoutMs: number) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body), signal: ctl.signal });
    const json = await res.json().catch(() => null);
    if (res.status === 429) throw new ProviderError("rate_limited", "limită furnizor", 429);
    if (res.status === 401 || res.status === 403) throw new ProviderError("config", "cheie API invalidă", res.status);
    if (res.status >= 500) throw new ProviderError(res.status === 503 || res.status === 529 ? "overloaded" : "upstream_error", "eroare furnizor " + res.status, res.status);
    if (!res.ok) throw new ProviderError("upstream_error", "eroare furnizor " + res.status + " " + JSON.stringify(json).slice(0, 200), res.status);
    return json;
  } catch (e) {
    if (e instanceof ProviderError) throw e;
    if ((e as Error)?.name === "AbortError") throw new ProviderError("timeout", "timeout");
    throw new ProviderError("upstream_error", String((e as Error)?.message || e).slice(0, 200));
  } finally {
    clearTimeout(t);
  }
}

/* ---------------- API compatibil OpenAI (OpenAI, Mistral, Groq, DeepSeek…) ---------------- */
async function callOpenAI(a: CallArgs): Promise<Completion> {
  const key = env("OPENAI_API_KEY");
  if (!key) throw new ProviderError("config", "OPENAI_API_KEY lipsește");
  const base = env("OPENAI_BASE_URL", "https://api.openai.com/v1").replace(/\/$/, "");
  const j = await postJson(base + "/chat/completions", { authorization: "Bearer " + key }, {
    model: env("AI_MODEL", "gpt-5.4-nano"),
    max_completion_tokens: a.maxTokens,
    messages: [{ role: "system", content: a.system }, ...a.messages],
  }, a.timeoutMs);
  const c = j?.choices?.[0];
  return { text: String(c?.message?.content ?? "").trim(), tokensIn: j?.usage?.prompt_tokens || 0, tokensOut: j?.usage?.completion_tokens || 0, stop: c?.finish_reason };
}

/* ---------------- Google Gemini ---------------- */
async function callGemini(a: CallArgs): Promise<Completion> {
  const key = env("GEMINI_API_KEY");
  if (!key) throw new ProviderError("config", "GEMINI_API_KEY lipsește");
  const model = env("AI_MODEL", "gemini-3.1-flash-lite");
  const base = env("GEMINI_BASE_URL", "https://generativelanguage.googleapis.com/v1beta").replace(/\/$/, "");
  const j = await postJson(`${base}/models/${encodeURIComponent(model)}:generateContent`, { "x-goog-api-key": key }, {
    systemInstruction: { parts: [{ text: a.system }] },
    contents: a.messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
    generationConfig: { maxOutputTokens: a.maxTokens },
  }, a.timeoutMs);
  const cand = j?.candidates?.[0];
  if (!cand && j?.promptFeedback?.blockReason) throw new ProviderError("refused", "blocat");
  const text = (cand?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("").trim();
  return { text, tokensIn: j?.usageMetadata?.promptTokenCount || 0, tokensOut: j?.usageMetadata?.candidatesTokenCount || 0, stop: cand?.finishReason };
}

export function providerName(): string { return env("AI_PROVIDER", "anthropic"); }
export function isConfigured(): boolean {
  const p = providerName();
  return p === "anthropic" ? !!env("ANTHROPIC_API_KEY") : p === "openai" ? !!env("OPENAI_API_KEY") : p === "gemini" ? !!env("GEMINI_API_KEY") : false;
}

function once(a: CallArgs): Promise<Completion> {
  const p = providerName();
  if (p === "anthropic") return callAnthropic(a);
  if (p === "openai") return callOpenAI(a);
  if (p === "gemini") return callGemini(a);
  throw new ProviderError("config", "AI_PROVIDER necunoscut: " + p);
}

/** Un apel, cu o singură reîncercare rapidă pentru erorile trecătoare (supraîncărcare, limită, 5xx),
    doar dacă mai e timp suficient din bugetul total (a.timeoutMs). */
export async function complete(a: CallArgs): Promise<Completion> {
  const t0 = Date.now();
  try {
    return await once(a);
  } catch (e) {
    const transient = e instanceof ProviderError && (e.code === "overloaded" || e.code === "rate_limited" || (e.code === "upstream_error" && e.status >= 500));
    const left = a.timeoutMs - (Date.now() - t0) - 800;
    if (!transient || left < 8000) throw e;
    await new Promise((r) => setTimeout(r, 800));
    return await once({ ...a, timeoutMs: left });
  }
}
