import { dbConnect } from "@/lib/db";
import { error, handle, json } from "@/lib/api";
import { STAFF, apiUser } from "@/lib/session";
import { assertChatAccess } from "@/lib/inbox";
import { gemini, scrub } from "@/lib/ai";
import { getSettings } from "@/lib/settings";
import { Client } from "@/models/Client";
import { Message } from "@/models/Message";
import { Project } from "@/models/Project";

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Three short reply suggestions for the latest client message in an inbox chat (like GoHighLevel). */
export const POST = handle(async (req: Request) => {
  const user = await apiUser(STAFF);
  const { clientId } = await req.json().catch(() => ({}));
  if (typeof clientId !== "string") return error("Missing chat");
  await assertChatAccess(user, clientId);
  await dbConnect();
  const [client, msgs, projects, settings] = await Promise.all([
    Client.findById(clientId).select("name company").lean<any>(),
    Message.find({ client: clientId, ticket: null, internal: { $ne: true } }).sort({ createdAt: -1 }).limit(12).lean<any[]>(),
    Project.find({ client: clientId }).select("title stage progress dueDate").sort({ updatedAt: -1 }).limit(4).lean<any[]>(),
    getSettings(),
  ]);
  if (!msgs.length) return json({ suggestions: [] });

  const firstName = String(client?.name || "").split(" ")[0] || "there";
  const transcript = msgs
    .reverse()
    .map((m) => `${m.authorRole === "client" ? "Client" : "Us"}: ${scrub(m.body) || "(sent a file)"}`)
    .join("\n");
  const projectInfo = projects.length
    ? projects.map((p) => `- ${p.title}: ${p.stage}${p.progress != null ? `, ${p.progress}% done` : ""}${p.dueDate ? `, due ${new Date(p.dueDate).toDateString()}` : ""}`).join("\n")
    : "No projects yet.";

  const text = await gemini({
    system: `You write reply suggestions for ${settings.companyName || "our agency"}, a digital agency (websites, marketing, ads, SEO, AI tools), replying to a client in chat.
Rules: professional, polite, confident and human. No emojis. Short (1-3 sentences). Never promise exact results or dates that are not in the data. Use the client's first name when natural.
Give 3 different options: 1) a direct helpful answer, 2) a short acknowledgement that we will check and update, 3) a reply that asks a useful clarifying question or moves the work forward.
Return JSON: {"suggestions": ["...", "...", "..."]}`,
    turns: [{ role: "user", text: `Client first name: ${firstName}\nCompany: ${client?.company || "-"}\nProjects:\n${projectInfo}\n\nChat (oldest first):\n${transcript}\n\nWrite 3 replies to the client's latest message.` }],
    json: true,
    temperature: 0.7,
    maxTokens: 500,
  });
  let suggestions: string[] = [];
  try {
    suggestions = (JSON.parse(text).suggestions || []).filter((s: unknown) => typeof s === "string" && s.trim()).slice(0, 3);
  } catch {
    suggestions = [];
  }
  return json({ suggestions });
});
