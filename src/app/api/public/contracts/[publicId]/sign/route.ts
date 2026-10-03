import { dbConnect } from "@/lib/db";
import { Contract } from "@/models/Contract";
import { Activity } from "@/models/Activity";
import { error, handle, json } from "@/lib/api";
import { clientIp } from "@/lib/docs";
import { notify, superAdminIds } from "@/lib/notify";

type Ctx = { params: Promise<{ publicId: string }> };

/** Client signs from the public link by typing their name. Body: { name, agree: true } */
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { publicId } = await params;
  if (!/^[A-Za-z0-9_-]{8,40}$/.test(publicId)) return error("Contract not found", 404);
  const b = await req.json().catch(() => ({}));
  const name = typeof b.name === "string" ? b.name.trim().slice(0, 120) : "";
  if (name.length < 2) return error("Type your full name to sign");
  if (b.agree !== true) return error("Please tick the box to agree");
  await dbConnect();

  // Atomic Sent -> Signed: the signature can only ever be recorded once.
  const contract = await Contract.findOneAndUpdate(
    { publicId, status: "Sent" },
    {
      $set: {
        status: "Signed",
        signedName: name,
        signedAt: new Date(),
        signedIp: clientIp(req),
        signedUA: (req.headers.get("user-agent") || "").slice(0, 300),
      },
    },
    { new: true }
  );
  if (!contract) {
    const existing = await Contract.findOne({ publicId }).select("status").lean<{ status: string }>();
    return error(existing?.status === "Signed" ? "This contract is already signed" : "This contract is not available for signing", existing ? 400 : 404);
  }

  await Activity.create({ client: contract.client, project: contract.project, actor: name, actorRole: "client", text: `Contract ${contract.number} signed`, visibleToClient: true });
  await notify(await superAdminIds(), {
    title: `Contract signed: ${contract.number}`,
    body: `${name} signed "${contract.title}".`,
    link: `/contracts/${contract._id}`,
    email: { button: "View contract" },
  });
  return json({ ok: true });
});
