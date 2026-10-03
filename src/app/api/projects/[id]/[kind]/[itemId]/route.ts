import { error, handle, json } from "@/lib/api";
import { STAFF, apiUser } from "@/lib/session";
import { projectFor } from "@/lib/projects";
import { ITEM_KINDS, afterItemChange, itemData, type ItemKind } from "@/lib/project-items";

type Ctx = { params: Promise<{ id: string; kind: string; itemId: string }> };

async function load(ctx: Ctx) {
  const user = await apiUser(STAFF);
  const { id, kind, itemId } = await ctx.params;
  if (!ITEM_KINDS.includes(kind as ItemKind)) return null;
  const project = await projectFor(user, id);
  const item = project[kind].id(itemId);
  return item ? { user, project, kind: kind as ItemKind, item } : null;
}

export const PUT = handle(async (req: Request, ctx: Ctx) => {
  const found = await load(ctx);
  if (!found) return error("Item not found", 404);
  const { user, project, kind, item } = found;
  const data = itemData(kind, await req.json(), false);
  const before = item.toObject();
  item.set(data);
  await project.save();
  await afterItemChange(project, kind, item, before, user);
  return json(project);
});

export const DELETE = handle(async (_req: Request, ctx: Ctx) => {
  const found = await load(ctx);
  if (!found) return error("Item not found", 404);
  const { project, item } = found;
  item.deleteOne();
  await project.save();
  return json(project);
});
