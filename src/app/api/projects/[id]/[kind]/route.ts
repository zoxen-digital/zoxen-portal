import { error, handle, json } from "@/lib/api";
import { STAFF, apiUser } from "@/lib/session";
import { projectFor } from "@/lib/projects";
import { ITEM_KINDS, addRevision, afterItemChange, itemData, type ItemKind } from "@/lib/project-items";

type Ctx = { params: Promise<{ id: string; kind: string }> };

/** Adds a checklist item, issue, revision or document to a project. */
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const user = await apiUser(STAFF);
  const { id, kind } = await params;
  if (!ITEM_KINDS.includes(kind as ItemKind)) return error("Not found", 404);
  const k = kind as ItemKind;
  const project = await projectFor(user, id);
  const data = itemData(k, await req.json(), true);

  let item;
  if (k === "revisions") {
    item = addRevision(project, data, user.name);
  } else {
    if (k === "documents") data.addedBy = user.name;
    project[k].push(data);
    item = project[k][project[k].length - 1];
  }
  await project.save();
  await afterItemChange(project, k, item, null, user);
  return json(project, 201);
});
