// Must load before the schema below is compiled (recycle bin for deletions).
import "@/lib/trash-plugin";
import { Schema, model, models, type Model } from "mongoose";

export const CHAT_PRIORITIES = ["Low", "Normal", "High", "Urgent"] as const;

/**
 * One inbox chat per client (WhatsApp style). Messages live in Message with `client` set and no ticket.
 * Assignment, priority, read state and participants are team-only and never sent to the client.
 */
const ConversationSchema = new Schema(
  {
    client: { type: Schema.Types.ObjectId, ref: "Client", required: true, unique: true },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    priority: { type: String, enum: CHAT_PRIORITIES, default: "Normal" },
    /** Default project new team messages are tagged with. */
    project: { type: Schema.Types.ObjectId, ref: "Project", default: null },
    /** Team members pulled in by an @mention, so they can open the chat even if not on a project. */
    participants: [{ type: Schema.Types.ObjectId, ref: "User" }],
    lastMessageAt: { type: Date, default: null, index: true },
    lastPreview: { type: String, default: "" },
    lastAuthorName: { type: String, default: "" },
    lastAuthorRole: { type: String, default: "" },
    /** Last time the client wrote; drives "unread" for the team. */
    lastClientAt: { type: Date, default: null },
    /** Last public team reply; drives "unread" for the client. */
    lastTeamAt: { type: Date, default: null },
    lastRepliedBy: { type: String, default: "" },
    /** userId -> last time that team member opened the chat. */
    reads: { type: Map, of: Date, default: {} },
    clientReadAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Conversation: Model<any> = models.Conversation || model("Conversation", ConversationSchema);
