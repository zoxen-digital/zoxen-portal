// Must load before the schema below is compiled (recycle bin for deletions).
import "@/lib/trash-plugin";
import { Schema, model, models, type Model } from "mongoose";

export const AttachmentSchema = new Schema(
  { name: { type: String, required: true }, url: { type: String, required: true }, size: Number, contentType: String },
  { _id: false }
);

/** One chat message between the client and the team, on a project or a support ticket. */
const MessageSchema = new Schema(
  {
    project: { type: Schema.Types.ObjectId, ref: "Project" },
    ticket: { type: Schema.Types.ObjectId, ref: "Ticket" },
    client: { type: Schema.Types.ObjectId, ref: "Client", required: true, index: true },
    author: { type: Schema.Types.ObjectId, ref: "User" },
    authorName: String,
    authorRole: String,
    body: { type: String, default: "" },
    attachments: { type: [AttachmentSchema], default: [] },
  },
  { timestamps: true }
);

MessageSchema.index({ project: 1, createdAt: 1 });
MessageSchema.index({ ticket: 1, createdAt: 1 });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Message: Model<any> = models.Message || model("Message", MessageSchema);
