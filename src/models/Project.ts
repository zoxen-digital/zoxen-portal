import { Schema, model, models, type Model } from "mongoose";

const ChecklistSchema = new Schema({
  label: { type: String, required: true, trim: true },
  done: { type: Boolean, default: false },
  doneAt: Date,
});

const IssueSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    details: String,
    status: { type: String, default: "Open" },
    owner: { type: String, trim: true },
    dueDate: Date,
    // Shown to the client as "Action needed" (e.g. "Please send your logo").
    visibleToClient: { type: Boolean, default: false },
    resolvedAt: Date,
  },
  { timestamps: true }
);

const RevisionSchema = new Schema(
  {
    round: { type: Number, required: true },
    request: { type: String, required: true },
    links: String,
    status: { type: String, default: "Requested" },
    requestedBy: String,
    // Beyond the package's included rounds: may be charged.
    extra: { type: Boolean, default: false },
    completedAt: Date,
  },
  { timestamps: true }
);

const DocumentSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    url: { type: String, required: true, trim: true },
    visibleToClient: { type: Boolean, default: true },
    addedBy: String,
  },
  { timestamps: true }
);

const ProjectSchema = new Schema(
  {
    client: { type: Schema.Types.ObjectId, ref: "Client", required: true, index: true },
    title: { type: String, required: true, trim: true },
    service: { type: String, trim: true },
    description: String,
    stage: { type: String, default: "Onboarding", index: true },
    progress: { type: Number, default: 5, min: 0, max: 100 },
    team: [{ type: Schema.Types.ObjectId, ref: "User", index: true }],
    startDate: Date,
    dueDate: Date,
    previewUrl: { type: String, trim: true },
    liveUrl: { type: String, trim: true },
    domain: { type: String, trim: true },
    // Short message the client sees on their portal ("We are building your inner pages").
    clientUpdate: String,
    internalNotes: String,
    revisionLimit: { type: Number, default: 2 },
    checklist: [ChecklistSchema],
    issues: [IssueSchema],
    revisions: [RevisionSchema],
    documents: [DocumentSchema],
    approvedAt: Date,
    approvedBy: String,
    feedback: { rating: Number, comment: String, at: Date },
    onboarding: { type: Schema.Types.ObjectId, ref: "Onboarding" },
    query: { type: Schema.Types.ObjectId, ref: "Query" },
    stageChangedAt: { type: Date, default: Date.now },
    // Last automatic "your review is waiting" reminder.
    reviewReminderAt: Date,
    lastMessageAt: Date,
  },
  { timestamps: true }
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Project: Model<any> = models.Project || model("Project", ProjectSchema);
