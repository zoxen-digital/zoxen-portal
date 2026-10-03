import { Schema, model, models, type Model } from "mongoose";

const MeetingSchema = new Schema(
  {
    client: { type: Schema.Types.ObjectId, ref: "Client", required: true, index: true },
    project: { type: Schema.Types.ObjectId, ref: "Project" },
    title: { type: String, required: true, trim: true },
    date: { type: Date, required: true },
    link: { type: String, trim: true },
    // Agenda before, summary / action points after. Visible to the client.
    notes: String,
    createdBy: String,
  },
  { timestamps: true }
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Meeting: Model<any> = models.Meeting || model("Meeting", MeetingSchema);
