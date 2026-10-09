// Must load before the schema below is compiled (recycle bin for deletions).
import "@/lib/trash-plugin";
import { Schema, model, models, type Model } from "mongoose";

/** Agreement the client signs online by typing their name. Signature details are kept as proof. */
const ContractSchema = new Schema(
  {
    number: { type: String, required: true, unique: true },
    publicId: { type: String, required: true, unique: true },
    client: { type: Schema.Types.ObjectId, ref: "Client", required: true, index: true },
    project: { type: Schema.Types.ObjectId, ref: "Project" },
    quote: { type: Schema.Types.ObjectId, ref: "Quote" },
    title: { type: String, required: true, trim: true },
    body: { type: String, default: "" },
    status: { type: String, default: "Draft", index: true },
    sentAt: Date,
    viewedAt: Date,
    signedName: String,
    signedAt: Date,
    signedIp: String,
    signedUA: String,
    createdBy: String,
  },
  { timestamps: true }
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Contract: Model<any> = models.Contract || model("Contract", ContractSchema);
