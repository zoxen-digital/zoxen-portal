import mongoose, { type Schema } from "mongoose";
import { currentContext } from "./request-context";

/**
 * Recycle bin: every document deleted through Mongoose is copied to the "trashitems"
 * collection first (kept 30 days), so the owner can restore it.
 * Registered globally, so it covers every model, however it is deleted.
 */
const SKIP = new Set(["TrashItem", "AuditLog", "LoginEvent", "Notification"]);
const TRASH = "trashitems";

/** A short, human label for the deleted thing (shown in the recycle bin). */
function labelOf(model: string, d: Record<string, unknown>) {
  const pick = (...keys: string[]) => keys.map((k) => d[k]).find((v) => typeof v === "string" && v) as string | undefined;
  return pick("invoiceNumber", "number", "title", "company", "name", "label", "email", "text") || `${model} ${String(d._id).slice(-6)}`;
}

async function save(model: string, collection: string, docs: Record<string, unknown>[]) {
  if (!docs.length || SKIP.has(model)) return;
  const ctx = currentContext();
  const now = new Date();
  await mongoose.connection.collection(TRASH).insertMany(
    docs.map((data) => ({
      model,
      collectionName: collection,
      docId: data._id,
      label: labelOf(model, data).slice(0, 200),
      data,
      batch: ctx?.id || null,
      deletedBy: ctx?.actor?.name || "System",
      deletedByRole: ctx?.actor?.role || "system",
      deletedAt: now,
    }))
  );
}

function trashPlugin(schema: Schema) {
  // Model.deleteOne / deleteMany / findByIdAndDelete / findOneAndDelete
  schema.pre(["deleteOne", "deleteMany", "findOneAndDelete"], { document: false, query: true }, async function (this: mongoose.Query<unknown, unknown>) {
    const model = this.model;
    if (SKIP.has(model.modelName)) return;
    const filter = this.getFilter();
    const op = (this as unknown as { op: string }).op;
    // Include fields that are normally hidden (e.g. password hashes) so a restore is complete.
    const hidden: string[] = [];
    model.schema.eachPath((p, t) => {
      if ((t as unknown as { options?: { select?: boolean } }).options?.select === false) hidden.push(`+${p}`);
    });
    const q = model.find(filter).select(hidden.join(" ")).lean();
    const docs = (op === "deleteMany" ? await q : await q.limit(1)) as Record<string, unknown>[];
    await save(model.modelName, model.collection.collectionName, docs);
  });
  // doc.deleteOne() runs the query hook above too (Mongoose deletes by _id), so no document hook is needed.
}

const g = globalThis as unknown as { _zxTrashPlugin?: boolean };
if (!g._zxTrashPlugin) {
  mongoose.plugin(trashPlugin);
  g._zxTrashPlugin = true;
}
