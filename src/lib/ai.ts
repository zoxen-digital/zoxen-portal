import { HttpError } from "./api";

/**
 * Google Gemini (AI Studio key in GEMINI_API_KEY). Free tier: Google may use prompts to improve its models,
 * so callers send short summaries only: no emails, phone numbers, passwords or payment details.
 */

const MODEL = () => process.env.GEMINI_MODEL || "gemini-2.5-flash";

export function aiEnabled() {
  return !!process.env.GEMINI_API_KEY;
}

type Turn = { role: "user" | "model"; text: string };

export async function gemini(opts: { system: string; turns: Turn[]; json?: boolean; temperature?: number; maxTokens?: number }) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new HttpError("AI is not set up yet. Add GEMINI_API_KEY in Vercel settings.", 503);
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL()}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: opts.system }] },
      contents: opts.turns.map((t) => ({ role: t.role, parts: [{ text: t.text }] })),
      generationConfig: {
        temperature: opts.temperature ?? 0.5,
        maxOutputTokens: opts.maxTokens ?? 800,
        ...(opts.json ? { responseMimeType: "application/json" } : {}),
      },
    }),
    signal: AbortSignal.timeout(25_000),
  }).catch(() => null);
  if (!res) throw new HttpError("AI did not respond. Try again in a moment.", 504);
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
