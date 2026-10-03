import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mail, Phone } from "lucide-react";
import { dbConnect } from "@/lib/db";
import { STAFF, pageUser } from "@/lib/session";
import { ticketScope } from "@/lib/tickets";
import { validId } from "@/lib/api";
import { Ticket } from "@/models/Ticket";
import { User } from "@/models/User";
import { Badge, InfoRow } from "@/components/ui";
import { DeleteButton } from "@/components/actions";
import { TicketControls } from "@/components/TicketForms";
import { ChatThread } from "@/components/ChatThread";
import { AttachmentList } from "@/components/FileUpload";
import { LocalTime } from "@/components/LocalTime";
import { OPEN_TICKET_STATUSES } from "@/lib/constants";
import { isOverdue, serialize } from "@/lib/utils";
import type { ClientT, TicketT } from "@/lib/types";

export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await pageUser(STAFF);
  const isOwner = user.role === "super_admin";
  const { id } = await params;
  if (!validId(id)) notFound();
  await dbConnect();
  const doc = await Ticket.findOne({ _id: id, ...(await ticketScope(user)) })
    .populate("client", "name company email phone")
    .populate("project", "title")
    .lean();
  if (!doc) notFound();
  const ticket = serialize<TicketT>(doc);
  const team = serialize<{ _id: string; name: string }[]>(
    await User.find({ role: { $in: ["team_admin", "super_admin"] }, status: "active" }).sort({ name: 1 }).select("name").lean()
  );
  const client = ticket.client as ClientT | null;
  const project = ticket.project as { _id: string; title: string } | null;
  const late = isOverdue(ticket.dueDate, !OPEN_TICKET_STATUSES.includes(ticket.status));

  return (
    <div className="space-y-6">
      <Link href="/tickets" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-fg">
        <ArrowLeft className="h-4 w-4" /> Back to tickets
      </Link>
      <div className="card p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="text-sm font-semibold text-muted">
              {ticket.number} · {ticket.type}
            </div>
            <h1 className="text-2xl font-bold text-heading">{ticket.title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge status={ticket.status} dot />
              <Badge status={ticket.priority} />
              {late && <Badge status="Overdue" />}
            </div>
          </div>
          {isOwner && <DeleteButton url={`/api/tickets/${ticket._id}`} redirectTo="/tickets" confirmText={`Delete ticket ${ticket.number} and its messages?`} />}
        </div>
        {ticket.description && <p className="mt-4 whitespace-pre-wrap rounded-xl bg-surface-2 p-4 text-sm text-fg">{ticket.description}</p>}
        <AttachmentList items={ticket.attachments} />
        <p className="mt-3 text-xs text-muted">
          Opened by {ticket.createdByName}
          {ticket.createdByRole === "client" ? " (client)" : ""} · <LocalTime iso={ticket.createdAt} />
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <ChatThread
            endpoint={`/api/tickets/${ticket._id}/messages`}
            side="team"
            title="Conversation with the client"
            subtitle="The client sees these messages on their portal."
            uploads={!!process.env.BLOB_READ_WRITE_TOKEN}
          />
        </div>
        <div className="space-y-6">
          <TicketControls ticket={ticket} team={team} isOwner={isOwner} />
          <div className="card p-5">
            <h2 className="mb-2 font-bold text-heading">Client</h2>
            <div className="divide-y divide-line">
              <InfoRow
                label="Name"
                value={
                  client &&
                  (isOwner ? (
                    <Link href={`/clients/${client._id}`} className="hover:text-brand">
                      {client.company || client.name}
                    </Link>
                  ) : (
                    client.company || client.name
                  ))
                }
              />
              <InfoRow
                label="Email"
                value={
                  client?.email && (
                    <a href={`mailto:${client.email}`} className="inline-flex items-center gap-1.5 hover:text-brand">
                      <Mail className="h-3.5 w-3.5" />
                      {client.email}
                    </a>
                  )
                }
              />
              <InfoRow
                label="Phone"
                value={
                  client?.phone && (
                    <a href={`tel:${client.phone}`} className="inline-flex items-center gap-1.5 hover:text-brand">
                      <Phone className="h-3.5 w-3.5" />
                      {client.phone}
                    </a>
                  )
                }
              />
              <InfoRow
                label="Project"
                value={
                  project && (
                    <Link href={`/projects/${project._id}`} className="hover:text-brand">
                      {project.title}
                    </Link>
                  )
                }
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
