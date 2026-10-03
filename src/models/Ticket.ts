import { Schema, model, models, type Model } from "mongoose";
import { AttachmentSchema } from "./Message";

/** Support request after launch: bug, change request, question or content update. */
const TicketSchema = new Schema(
  {
    number: { type: String, required: true, unique: true },
    client: { type: Schema.Types.ObjectId, ref: "Client", required: true, index: true },
    project: { type: Schema.Types.ObjectId, ref: "Project" },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    type: { type: String, default: "Bug" },
    priority: { type: String, default: "Medium" },
    status: { type: String, default: "Open", index: true },
    assignee: { type: Schema.Types.ObjectId, ref: "User", index: true },
    dueDate: Date,
    createdByName: String,
    createdByRole: String,
    attachments: { type: [AttachmentSchema], default: [] },
    resolvedAt: Date,
  },
  { timestamps: true }
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Ticket: Model<any> = models.Ticket || model("Ticket", TicketSchema);
