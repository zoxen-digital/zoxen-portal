import mongoose from "mongoose";
import { dbConnect } from "@/lib/db";
import { TrashItem } from "@/models/TrashItem";
import { error, handle, json } from "@/lib/api";
import { AGENT, apiUser } from "@/lib/session";

type Ctx = { params: Promise<{ batch: string }> };

/**
 * Restores everything deleted together (e.g. a client with its projects and meetings).
 * Items whose id already exists again are skipped, so a restore can never duplicate data.
 */
export const POST = handle(async (_req: Request, { params }: Ctx) => {
  const user = await apiUser(AGENT);
  const { batch } = await params;
  if (!/^[A-Za-z0-9]{6,40}$/.test(batch)) return error("Not found", 404);
  await dbConnect();
  // Single deletions without a request batch are stored with their own id as the batch key.
  const items = await TrashItem.find({ $or: [{ batch }, ...(mongoose.isValidObjectId(batch) ? [{ _id: batch }] : [])], restoredAt: null }).lean<
    { _id: unknown; collectionName: string; docId: unknown; data: Record<string, unknown>; label: string }[]
  >();
  if (!items.length) return error("Nothing to restore (already restored or expired)", 404);
  let restored = 0;
  const labels: string[] = [];
  for (const it of items) {
    const col = mongoose.connection.collection(it.collectionName);
    if (await col.findOne({ _id: it.docId as never })) continue;
    await col.insertOne(it.data as never);
    restored++;
    labels.push(it.label);
  }
  await TrashItem.updateMany({ _id: { $in: items.map((i) => i._id) } }, { $set: { restoredAt: new Date(), restoredBy: user.name } });
  return json({ ok: true, restored, title: labels[0] || "items" });
});
