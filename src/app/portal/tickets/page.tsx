import Link from "next/link";
import { LifeBuoy } from "lucide-react";
import { dbConnect } from "@/lib/db";
import { pageUser } from "@/lib/session";
import { Ticket } from "@/models/Ticket";
import { Project } from "@/models/Project";
import { Badge, EmptyState } from "@/components/ui";
import { PortalNewTicketButton } from "@/components/TicketForms";
import { LocalTime } from "@/components/LocalTime";
import { serialize } from "@/lib/utils";
import type { TicketT } from "@/lib/types";

export const metadata = { title: "Support" };

export default async function PortalTickets() {
  const user = await pageUser(["client"]);
  await dbConnect();
  const [docs, projectDocs] = await Promise.all([
    Ticket.find({ client: user.clientId }).sort({ updatedAt: -1 }).limit(200).lean(),
    Project.find({ client: user.clientId }).sort({ updatedAt: -1 }).select("title").lean(),
  ]);
  const tickets = serialize<TicketT[]>(docs);
  const projects = serialize<{ _id: string; title: string }[]>(projectDocs);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-heading sm:text-[28px]">Support</h1>
          <p className="mt-1 text-sm text-muted">Report a problem or ask for a change. Every request is tracked until it is done.</p>
        </div>
        <PortalNewTicketButton projects={projects} uploads={!!process.env.BLOB_READ_WRITE_TOKEN} />
      </div>
      <div className="card overflow-hidden">
        {tickets.length === 0 ? (
          <EmptyState icon={LifeBuoy} title="No requests yet" text="Need a change or found an issue? Open a support request." />
        ) : (
          <ul className="divide-y divide-line">
            {tickets.map((t) => (
              <li key={t._id}>
                <Link href={`/portal/tickets/${t._id}`} className="flex flex-col gap-2 p-4 hover:bg-surface-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-muted">
                      {t.number} · {t.type}
                    </div>
                    <div className="font-semibold text-heading">{t.title}</div>
                    <div className="text-xs text-muted">
                      Updated <LocalTime iso={t.updatedAt} />
                    </div>
                  </div>
                  <Badge status={t.status} dot />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
