import { dbConnect } from "@/lib/db";
import { Contract } from "@/models/Contract";
import { error, handle, json, validId } from "@/lib/api";
import { ADMIN, apiUser } from "@/lib/session";
import { contractData, sendContract } from "@/lib/contracts";

type Ctx = { params: Promise<{ id: string }> };

/** Edit text (before signing) or an action: { action: "send" | "void" | "reopen" } */
export const PUT = handle(async (req: Request, { params }: Ctx) => {
  const user = await apiUser(ADMIN);
  const { id } = await params;
  if (!validId(id)) return error("Contract not found", 404);
  await dbConnect();
  const contract = await Contract.findById(id);
  if (!contract) return error("Contract not found", 404);
  if (contract.status === "Signed") return error("A signed contract cannot be changed. Create a new one instead.");
  const b = await req.json().catch(() => ({}));

  if (b.action === "send") return json({ contract, via: await sendContract(contract, user) });
  if (b.action === "void") contract.status = "Void";
  else if (b.action === "reopen") contract.status = "Draft";
  else if (b.action) return error("Unknown action");
  else contract.set(contractData(b));
  await contract.save();
  return json({ contract });
});

export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  await apiUser(ADMIN);
  const { id } = await params;
  if (!validId(id)) return error("Contract not found", 404);
  await dbConnect();
  const contract = await Contract.findById(id);
  if (!contract) return json({ ok: true });
  if (contract.status === "Signed") return error("Signed contracts are kept as a legal record");
  await contract.deleteOne();
  return json({ ok: true });
});
