import { dbConnect } from "./db";
import { appUrl, sendMail } from "./mailer";
import { clientUserIds, notify } from "./notify";
import { formatDate, formatMoney } from "./utils";
import { Activity } from "@/models/Activity";
import { Client } from "@/models/Client";

type Message = {
  title: string;
  body: string;
  /** App path (e.g. /portal or /invoice/abc). */
  link?: string;
  button?: string;
  email?: boolean;
};

/**
 * Notifies a client company: every portal login gets bell + push (+ email).
 * If nobody has a portal login yet, the email still goes to the client's email address,
 * so invoices and follow-ups reach them either way.
 * Returns how it was delivered, for the toast.
 */
export async function notifyClient(clientId: string, m: Message, actor?: { name: string; role: string }) {
  await dbConnect();
  const users = await clientUserIds(clientId);
  let via: "portal" | "email" | "none" = "none";
  if (users.length) {
    await notify(users, { title: m.title, body: m.body, link: m.link, email: m.email ? { button: m.button } : undefined });
    via = "portal";
  } else if (m.email) {
    const client = await Client.findById(clientId).select("name email").lean<{ name: string; email?: string }>();
    if (client?.email) {
      const sent = await sendMail({
        to: client.email,
        subject: m.title,
        heading: m.title,
        lines: [`Hi ${client.name.split(" ")[0]},`, m.body],
        // Without a portal login, only public links (invoices, quotes, contracts) are useful.
        button: m.link && /^\/(invoice|quote|contract)\//.test(m.link) ? { label: m.button || "Open", url: appUrl(m.link) } : undefined,
      });
      if (sent) via = "email";
    }
  }
  try {
    await Activity.create({ client: clientId, actor: actor?.name, actorRole: actor?.role, text: m.title, visibleToClient: true });
  } catch (e) {
    console.error("Activity log failed:", e);
  }
  return via;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Inv = any;

export function invoiceIssuedMessage(inv: Inv): Message {
  return {
    title: `New invoice ${inv.invoiceNumber}`,
    body: `Amount: ${formatMoney(inv.totals?.total, inv.currency)}${inv.dueDate ? `, due ${formatDate(inv.dueDate)}` : ""}. You can view, download and pay it online.`,
    link: `/invoice/${inv.publicId}`,
    button: "View invoice",
    email: true,
  };
}

export function paymentReceivedMessage(inv: Inv, amount: number): Message {
  const balance = inv.totals?.balance || 0;
  return {
    title: `Payment received: ${formatMoney(amount, inv.currency)}`,
    body: `Thank you! We received your payment for invoice ${inv.invoiceNumber}. ${
      balance > 0 ? `Remaining balance: ${formatMoney(balance, inv.currency)}.` : "This invoice is now fully paid."
    }`,
    link: `/invoice/${inv.publicId}`,
    button: "View receipt",
    email: true,
  };
}

export function invoiceReminderMessage(inv: Inv, note?: string): Message {
  const overdue = inv.dueDate && new Date(inv.dueDate).getTime() < Date.now();
  return {
    title: `${overdue ? "Overdue" : "Payment reminder"}: invoice ${inv.invoiceNumber}`,
    body:
      `A friendly reminder that ${formatMoney(inv.totals?.balance, inv.currency)} is ${overdue ? "past due" : "due"}` +
      `${inv.dueDate ? ` (due ${formatDate(inv.dueDate)})` : ""}. ${note ? note + " " : ""}If you have already paid, please ignore this message.`,
    link: `/invoice/${inv.publicId}`,
    button: "View and pay",
    email: true,
  };
}
