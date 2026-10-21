import { HttpError } from "./api";

/**
 * Google Gemini (AI Studio key in GEMINI_API_KEY). Free tier: Google may use prompts to improve its models,
 * so callers send short summaries only: no emails, phone numbers, passwords or payment details.
 */

/**
 * "-latest" aliases always point at Google's current Flash models (older fixed versions get retired for new keys).
 * If one is busy (503) or unavailable, the next is tried.
 */
const MODELS = (fast?: boolean) =>
  [...new Set((fast ? ["gemini-flash-lite-latest", "gemini-flash-latest"] : [process.env.GEMINI_MODEL, "gemini-flash-latest", "gemini-flash-lite-latest"]).filter(Boolean) as string[])];

export function aiEnabled() {
  return !!process.env.GEMINI_API_KEY;
}

type Turn = { role: "user" | "model"; text: string };

/** `fast`: lighter model first (a few seconds instead of ~20), for short things like reply suggestions. */
export async function gemini(opts: { system: string; turns: Turn[]; json?: boolean; temperature?: number; maxTokens?: number; fast?: boolean }) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new HttpError("AI is not set up yet. Add GEMINI_API_KEY in Vercel settings.", 503);
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: opts.system }] },
    contents: opts.turns.map((t) => ({ role: t.role, parts: [{ text: t.text }] })),
    generationConfig: {
      temperature: opts.temperature ?? 0.5,
      // Newer models spend part of this on thinking, so leave room for the answer.
      maxOutputTokens: (opts.maxTokens ?? 800) + 1500,
      ...(opts.json ? { responseMimeType: "application/json" } : {}),
    },
  });
  let res: Response | null = null;
  for (const model of MODELS(opts.fast)) {
    res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body,
      signal: AbortSignal.timeout(25_000),
    }).catch(() => null);
    if (res && ![404, 500, 503].includes(res.status)) break;
  }
  if (!res) throw new HttpError("AI did not respond. Try again in a moment.", 504);
  if (res.status === 503) throw new HttpError("AI is busy right now. Try again in a minute.", 503);
  if (res.status === 429) throw new HttpError("AI daily free limit reached. It resets tomorrow.", 429);
  if (!res.ok) throw new HttpError("AI is unavailable right now.", 502);
  const data = (await res.json().catch(() => null)) as { candidates?: { content?: { parts?: { text?: string }[] } }[] } | null;
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
  if (!text) throw new HttpError("AI gave an empty answer. Try rephrasing.", 502);
  return text.trim();
}

/** Removes emails, phone numbers and long digit runs before text is sent to the AI. */
export function scrub(s: string) {
  return String(s || "")
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[email]")
    .replace(/\+?\d[\d\s().-]{7,}\d/g, "[number]")
    .slice(0, 600);
}
