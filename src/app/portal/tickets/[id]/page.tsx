import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { dbConnect } from "@/lib/db";
import { pageUser } from "@/lib/session";
import { validId } from "@/lib/api";
import { Ticket } from "@/models/Ticket";
import { Badge } from "@/components/ui";
import { ChatThread } from "@/components/ChatThread";
import { AttachmentList } from "@/components/FileUpload";
import { PortalTicketActions } from "@/components/TicketForms";
import { LocalTime } from "@/components/LocalTime";
import { serialize } from "@/lib/utils";
import type { TicketT } from "@/lib/types";

export default async function PortalTicketPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await pageUser(["client"]);
  const { id } = await params;
  if (!validId(id)) notFound();
  await dbConnect();
  const doc = await Ticket.findOne({ _id: id, client: user.clientId }).populate("project", "title").populate("assignee", "name").lean();
  if (!doc) notFound();
  const t = serialize<TicketT>(doc);
  const project = t.project as { title: string } | null;
  const assignee = t.assignee as { name: string } | null;

  return (
    <div className="space-y-6">
      <Link href="/portal/tickets" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-fg">
        <ArrowLeft className="h-4 w-4" /> All requests
      </Link>
      <div className="card p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="text-sm font-semibold text-muted">
              {t.number} · {t.type}
              {project ? ` · ${project.title}` : ""}
            </div>
            <h1 className="text-2xl font-bold text-heading">{t.title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge status={t.status} dot />
              <span className="text-xs text-muted">
                Opened <LocalTime iso={t.createdAt} />
                {assignee ? ` · Handled by ${assignee.name.split(" ")[0]}` : ""}
              </span>
            </div>
          </div>
          <PortalTicketActions ticket={t} />
        </div>
        {t.status === "Resolved" && (
          <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200">
            Our team marked this as resolved. Please check, then close it, or tell us if something is still wrong.
          </p>
        )}
        {t.status === "Waiting on Client" && (
          <p className="mt-4 rounded-xl bg-violet-50 p-3 text-sm text-violet-800 dark:bg-violet-500/10 dark:text-violet-200">
            We need something from you to continue. Please reply below.
          </p>
        )}
        {t.description && <p className="mt-4 whitespace-pre-wrap rounded-xl bg-surface-2 p-4 text-sm text-fg">{t.description}</p>}
        <AttachmentList items={t.attachments} />
      </div>
      <ChatThread
        endpoint={`/api/portal/tickets/${t._id}/messages`}
        side="client"
        title="Conversation"
        subtitle="Reply here. Our team is notified right away."
        uploads={!!process.env.BLOB_READ_WRITE_TOKEN}
      />
    </div>
  );
}
