import { Schema, model, models, type Model } from "mongoose";

/** Who did what, when. The accountability trail for projects. */
const ActivitySchema = new Schema(
  {
    project: { type: Schema.Types.ObjectId, ref: "Project", index: true },
    client: { type: Schema.Types.ObjectId, ref: "Client", index: true },
    actor: String,
    actorRole: String,
    text: { type: String, required: true },
    visibleToClient: { type: Boolean, default: false },
  },
  { timestamps: true }
);

ActivitySchema.index({ project: 1, createdAt: -1 });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Activity: Model<any> = models.Activity || model("Activity", ActivitySchema);
