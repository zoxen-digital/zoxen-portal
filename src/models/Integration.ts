// Must load before the schema below is compiled (recycle bin for deletions).
import "@/lib/trash-plugin";
import { Schema, model, models, type Model } from "mongoose";

/** Third-party connections (Google Calendar). Server only: never sent to the browser. */
const IntegrationSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    email: String,
    refreshToken: String,
    accessToken: String,
    accessTokenExpires: Date,
    status: { type: String, enum: ["connected", "disconnected"], default: "disconnected" },
    connectedAt: Date,
    lastError: String,
  },
  { timestamps: true }
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Integration: Model<any> = models.Integration || model("Integration", IntegrationSchema);
