import { gemini } from "@/lib/ai";

/**
 * Writes the first email for a prospect. AI (fast model, one short call) only rephrases facts we
 * measured; if AI is unavailable or over quota, a plain template with the same facts is used.
 * Follow-ups never use AI.
 */

type P = { name: string; category?: string; city?: string; website?: string; audit?: { findings?: string[]; reachable?: boolean } | null };
type Cfg = { senderName: string; offer: string; companyName: string };

const cityShort = (c?: string) => (c || "").split(",")[0]!.trim();
const kind = (c?: string) => (c ? c.replace(/s$/, "") : "business");

export function templateEmail(p: P, cfg: Cfg) {
  const top = (p.audit?.findings || []).slice(0, 2);
  const sign = `${cfg.senderName || "The team"}\n${cfg.companyName}`;
  if (!p.website) {
    return {
      subject: `Website for ${p.name}?`,
      body: `Hi ${p.name} team,\n\nI was looking for ${p.name} online${p.city ? ` in ${cityShort(p.city)}` : ""} and couldn't find a website, only listings. Customers usually check the menu, hours and location on Google before they visit.\n\n${cfg.offer}\n\nWould you like me to put together a free demo homepage for ${p.name} so you can see how it would look? No cost and no obligation.\n\nBest,\n${sign}`,
    };
  }
  return {
    subject: `Quick note about ${p.name}'s website`,
    body: `Hi ${p.name} team,\n\nI had a quick look at your website and noticed${top.length ? ":\n\n- " + top.join("\n- ") : " a few things that could be improved"}\n\nThese are usually quick fixes, and they make a real difference for people finding a ${kind(p.category)} on their phone.\n\n${cfg.offer}\n\nWould a free 3-point improvement plan for ${p.name} be useful? Happy to send it over.\n\nBest,\n${sign}`,
  };
}

export function followUpEmail(n: number, p: P, cfg: Cfg) {
  const sign = `${cfg.senderName || "The team"}\n${cfg.companyName}`;
  return n === 1
    ? `Hi ${p.name} team,\n\nJust bringing this back to the top of your inbox in case it got buried. Happy to send ${p.website ? "the free improvement plan" : "a free demo homepage"}, just reply "yes".\n\nBest,\n${sign}`
    : `Hi ${p.name} team,\n\nI'll leave it here so I don't fill your inbox. If a better website ever becomes a priority, just reply to this email and I'll help.\n\nAll the best,\n${sign}`;
}

/** Puts the greeting and sign-off on their own lines and keeps blank lines between paragraphs. */
function paragraphs(s: string) {
  let t = s.replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").trim();
  t = t.replace(/^((?:Hi|Hello|Hey|Dear)\b[^,\n]{0,60},)[ \t]*/i, "$1\n\n");
  t = t.replace(/[ \t]*((?:Best|Best regards|Kind regards|Regards|Thanks|Cheers|All the best|Warm regards),)[ \t]*/i, "\n\n$1\n");
  return t.replace(/\n{3,}/g, "\n\n");
}

/** AI version: same facts, more natural wording. Falls back to the template on any problem. */
export async function writeFirstEmail(p: P, cfg: Cfg): Promise<{ subject: string; body: string; by: "ai" | "template" }> {
  const facts = (p.audit?.findings || []).slice(0, 3);
  try {
    const text = await gemini({
      fast: true,
      json: true,
      temperature: 0.6,
      maxTokens: 400,
      system: `You write short cold emails for ${cfg.companyName}, a web agency, to small local businesses in the US.
Rules: 70-120 words. Plain text, no emojis, no markdown, no links. Friendly, specific, human, not salesy. No fake compliments, no claims you cannot see in the FACTS, never invent numbers or results, never promise rankings or revenue.
Structure: greeting using the business name, 1-2 sentences on the specific FACTS, 1 sentence on the offer, a soft question as call to action. Sign off with the sender name and company on separate lines. Separate the greeting, each paragraph and the sign-off with a blank line (use \\n\\n inside the JSON string).
Subject: under 7 words, lowercase-friendly, no clickbait, no "!" and no ALL CAPS.
Return JSON {"subject":"...","body":"..."}`,
      turns: [
        {
          role: "user",
          text: `Business: ${p.name}\nType: ${p.category || "local business"}\nCity: ${cityShort(p.city)}\nWebsite: ${p.website ? "yes" : "none found"}\nFACTS (only use these):\n${facts.length ? facts.map((f) => "- " + f).join("\n") : p.website ? "- (no major problems found)" : "- No website found, only map/directory listings"}\nOffer: ${cfg.offer}\nIf no website: offer a free demo homepage. If website: offer a free 3-point improvement plan.\nSender: ${cfg.senderName || "The team"}\nCompany: ${cfg.companyName}`,
        },
      ],
    });
    const j = JSON.parse(text) as { subject?: string; body?: string };
    const subject = String(j.subject || "").replace(/[\r\n]/g, " ").trim().slice(0, 90);
    const body = paragraphs(String(j.body || ""));
    // Guard rails: reject anything off-format and use the template instead.
    if (!subject || body.length < 120 || body.length > 1400 || /https?:\/\/|\[|\{\{|lorem/i.test(body)) throw new Error("bad draft");
    return { subject, body, by: "ai" };
  } catch {
    return { ...templateEmail(p, cfg), by: "template" };
  }
}

/** Reply sorting: keywords first (free); AI only when the reply is unclear. */
export async function classifyReply(text: string): Promise<string> {
  const t = text.toLowerCase().slice(0, 1500);
  if (/unsubscribe|remove me|stop emailing|take me off|do not contact|don'?t contact/.test(t)) return "Unsubscribe";
  if (/out of (the )?office|auto.?reply|automatic reply|on vacation|away until/.test(t)) return "Out of Office";
  if (/not interested|no thank|no,? thanks|we('| a)re good|already have|not at this time|pass on this/.test(t)) return "Not Interested";
  if (/\byes\b|interested|sounds good|let'?s talk|call me|send (it|the|me)|how much|price|pricing|cost|quote|demo|tell me more|more info/.test(t)) return "Interested";
  try {
    const out = await gemini({
      fast: true,
      temperature: 0,
      maxTokens: 20,
      system: `Classify a business owner's reply to a cold email from a web agency. Answer with exactly one of: Interested, Not Interested, Follow-Up Required, Out of Office, Other.`,
      turns: [{ role: "user", text: t.slice(0, 800) }],
    });
    const c = ["Interested", "Not Interested", "Follow-Up Required", "Out of Office", "Other"].find((x) => out.toLowerCase().includes(x.toLowerCase()));
    return c || "Follow-Up Required";
  } catch {
    return "Follow-Up Required";
  }
}
