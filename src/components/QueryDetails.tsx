"use client";

import { useState } from "react";
import Link from "next/link";
import { Building2, CalendarDays, Globe, Mail, MessageCircle, Phone, Wallet } from "lucide-react";
import { Drawer } from "./Drawer";
import { Badge } from "./ui";
import { formatDate } from "@/lib/utils";
import type { ClientT, QueryT } from "@/lib/types";

/** The query title; clicking it opens a side panel with everything about the query (and the lead's contact details). */
export function QueryDetails({ q }: { q: QueryT }) {
  const [open, setOpen] = useState(false);
  const c = q.client && typeof q.client === "object" ? (q.client as ClientT) : null;
  const l = q.lead;
  const phone = l?.phone || c?.phone || "";
  const email = l?.email || c?.email || "";
  const wa = phone.replace(/[^\d]/g, "");

  const Row = ({ icon: Icon, label, children }: { icon: typeof Mail; label: string; children: React.ReactNode }) => (
    <div className="flex items-start gap-3 py-2.5">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
      <div className="min-w-0 flex-1">
        <div className="text-xs text-muted">{label}</div>
        <div className="break-words text-sm text-fg">{children}</div>
      </div>
    </div>
  );

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="block max-w-[260px] text-left">
        <span className="block truncate font-medium text-fg hover:text-brand hover:underline" title={q.title}>
          {q.title}
        </span>
      </button>
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title={q.title}
        subtitle={`${l?.name ? "Website lead" : "Query"} · ${formatDate(q.createdAt)}`}
        badge={<Badge status={q.status} />}
        footer={
          (email || wa) && (
            <div className="flex flex-wrap gap-2">
              {wa && (
                <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-sm">
                  <MessageCircle className="h-4 w-4" /> WhatsApp
                </a>
              )}
              {phone && (
                <a href={`tel:${phone}`} className="btn btn-outline btn-sm">
                  <Phone className="h-4 w-4" /> Call
                </a>
              )}
              {email && (
                <a href={`mailto:${email}?subject=${encodeURIComponent(`Re: ${q.title}`)}`} className="btn btn-outline btn-sm">
                  <Mail className="h-4 w-4" /> Email
                </a>
              )}
            </div>
          )
        }
      >
        <div className="space-y-5">
          <section>
            <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-muted">{l?.name && !c ? "Lead" : "Client"}</h3>
            <div className="divide-y divide-line rounded-xl border border-line px-4">
              <Row icon={Building2} label="Name">
                {c ? (
                  <Link href={`/clients/${c._id}`} className="font-semibold text-brand hover:underline">
                    {c.company || c.name}
                  </Link>
                ) : (
                  <span className="font-semibold">
                    {l?.name}
                    {l?.company ? ` · ${l.company}` : ""}
                  </span>
                )}
              </Row>
              {email && (
                <Row icon={Mail} label="Email">
                  <a href={`mailto:${email}`} className="hover:underline">
                    {email}
                  </a>
                </Row>
              )}
              {phone && (
                <Row icon={Phone} label="Phone / WhatsApp">
                  <a href={`tel:${phone}`} className="hover:underline">
                    {phone}
                  </a>
                </Row>
              )}
              {l?.budget && (
                <Row icon={Wallet} label="Budget">
                  {l.budget}
                </Row>
              )}
              {(l?.source || l?.page) && (
                <Row icon={Globe} label="Came from">
                  {l?.source || "Website"}
                  {l?.page && (
                    <>
                      {" · "}
                      <a href={l.page} target="_blank" rel="noopener noreferrer" className="break-all text-brand hover:underline">
                        {l.page}
                      </a>
                    </>
                  )}
                </Row>
              )}
              <Row icon={CalendarDays} label="Received">
                {new Date(q.createdAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
              </Row>
            </div>
          </section>

          <section>
            <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-muted">Message</h3>
            <div className="whitespace-pre-wrap rounded-xl bg-surface-2 p-4 text-sm text-fg">{q.description || "No message."}</div>
          </section>

          <section className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl border border-line p-3">
              <div className="text-xs text-muted">Service</div>
              <div className="font-semibold">{q.service || "—"}</div>
            </div>
            <div className="rounded-xl border border-line p-3">
              <div className="text-xs text-muted">Priority</div>
              <div className="font-semibold">{q.priority || "Medium"}</div>
            </div>
            <div className="rounded-xl border border-line p-3">
              <div className="text-xs text-muted">Assigned to</div>
              <div className="font-semibold">{q.assignedTo || "Unassigned"}</div>
            </div>
            <div className="rounded-xl border border-line p-3">
              <div className="text-xs text-muted">Due</div>
              <div className="font-semibold">{q.dueDate ? formatDate(q.dueDate) : "—"}</div>
            </div>
          </section>

          {q.notes && (
            <section>
              <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-muted">Team notes</h3>
              <div className="whitespace-pre-wrap rounded-xl bg-amber-50 p-4 text-sm text-amber-950 dark:bg-amber-500/10 dark:text-amber-100">{q.notes}</div>
            </section>
          )}

          {!c && l?.name && <p className="text-xs text-muted">Not a client yet. When they sign up, create the client and link it from Edit (pencil) on this query.</p>}
        </div>
      </Drawer>
    </>
  );
}
