import { dbConnect } from "@/lib/db";
import { Contract } from "@/models/Contract";
import { Client } from "@/models/Client";
import { Project } from "@/models/Project";
import { Quote } from "@/models/Quote";
import { error, handle, json, validId } from "@/lib/api";
import { ADMIN, apiUser } from "@/lib/session";
import { nextNumber } from "@/lib/docs";
import { newPublicId } from "@/lib/invoices";
import { contractData, sendContract } from "@/lib/contracts";

export const GET = handle(async () => {
  await apiUser(ADMIN);
  await dbConnect();
  return json(await Contract.find().sort({ createdAt: -1 }).limit(500).populate("client", "name company").lean());
});

/** Body: { client, project?, quote?, title, body, send? } */
export const POST = handle(async (req: Request) => {
  const user = await apiUser(ADMIN);
  await dbConnect();
  const b = await req.json().catch(() => ({}));
  if (!b.client || !validId(String(b.client)) || !(await Client.exists({ _id: b.client }))) return error("Choose a client");
  const project = b.project && validId(String(b.project)) && (await Project.exists({ _id: b.project, client: b.client })) ? b.project : undefined;
  const quote = b.quote && validId(String(b.quote)) && (await Quote.exists({ _id: b.quote, client: b.client })) ? b.quote : undefined;
  const contract = await Contract.create({
    ...contractData(b),
    client: b.client,
    project,
    quote,
    number: await nextNumber(Contract, "C"),
    publicId: newPublicId(),
    status: "Draft",
    createdBy: user.name,
  });
  const via = b.send ? await sendContract(contract, user) : null;
  return json({ contract, via }, 201);
});
