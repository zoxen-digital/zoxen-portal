// Must load before the schema below is compiled (recycle bin for deletions).
import "@/lib/trash-plugin";
import { Schema, model, models, type Model } from "mongoose";

const QuerySchema = new Schema(
  {
    /** Empty for website leads until the team links or creates a client. */
    client: { type: Schema.Types.ObjectId, ref: "Client", default: null, index: true },
    /** Contact details of a website lead (no client yet). */
    lead: {
      name: String,
      email: String,
      phone: String,
      company: String,
      budget: String,
      source: String,
      page: String,
    },
    title: { type: String, required: true, trim: true },
    service: { type: String, trim: true },
    description: { type: String },
    status: { type: String, default: "Pending", index: true },
    priority: { type: String, default: "Medium" },
    assignedTo: { type: String, trim: true },
    amount: { type: Number, default: 0 },
    dueDate: { type: Date },
    notes: { type: String },
  },
  { timestamps: true }
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Query: Model<any> = models.Query || model("Query", QuerySchema);
