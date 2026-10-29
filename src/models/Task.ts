// Must load before the schema below is compiled (recycle bin for deletions).
import "@/lib/trash-plugin";
import { Schema, model, models, type Model } from "mongoose";

/** Personal / team to-dos shown on My Day. */
const TaskSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    dueAt: { type: Date, default: null },
    assignee: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    done: { type: Boolean, default: false },
    doneAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Task: Model<any> = models.Task || model("Task", TaskSchema);
