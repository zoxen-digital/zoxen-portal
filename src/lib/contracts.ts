import { HttpError } from "./api";
import { formatDate, formatMoney } from "./utils";
import { notifyClient } from "./client-notify";

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Used when Settings has no contract template. Placeholders are filled in when a contract is created. */
export const DEFAULT_CONTRACT = `SERVICE AGREEMENT

This agreement is made on {{date}} between {{company_name}} ("we") and {{client_name}}{{client_company}} ("you").

1. SCOPE OF WORK
We will deliver: {{project}}.
The full scope is described in the proposal or project details shared in your client portal. Work outside this scope will be quoted separately before it starts.

2. FEES AND PAYMENT
Total fee: {{total}}.
{{payment_terms}}
Invoices are payable by the due date shown on each invoice.

3. TIMELINE
The timeline starts once we receive the advance payment and the content needed from you (text, images, logos, access). Delays in content or feedback move the delivery date accordingly.

4. REVISIONS
The number of revision rounds included is stated in the proposal. Extra rounds may be charged after we confirm with you.

5. YOUR RESPONSIBILITIES
You confirm that you own or have the right to use all content you provide, and you will review and respond to work within a reasonable time.

6. OWNERSHIP
Once all invoices are paid in full, the final deliverables belong to you. We may show the work in our portfolio unless you ask us not to.

7. CONFIDENTIALITY
Both sides keep private information shared during the project confidential.

8. CANCELLATION
Either side may end this agreement in writing. Work completed up to that date is payable. Advance payments cover work already started and are not refundable.

9. SUPPORT
After launch, support requests can be raised from your client portal.

By signing below, you confirm that you have read and agree to this agreement.`;

export function fillTemplate(
  template: string,
  v: { companyName: string; clientName: string; clientCompany?: string; project?: string; total?: number; currency?: string; paymentTerms?: string }
) {
  const map: Record<string, string> = {
    date: formatDate(new Date()),
    company_name: v.companyName,
    client_name: v.clientName,
    client_company: v.clientCompany ? ` of ${v.clientCompany}` : "",
    project: v.project || "the services agreed with you",
    total: v.total ? formatMoney(v.total, v.currency) : "as stated in the proposal / invoice",
    payment_terms: v.paymentTerms || "",
  };
  return template.replace(/\{\{(\w+)\}\}/g, (m, k: string) => (k in map ? map[k]! : m));
}

export function contractData(body: any) {
  const title = typeof body.title === "string" ? body.title.trim().slice(0, 200) : "";
  if (!title) throw new HttpError("Contract title is required");
  const text = typeof body.body === "string" ? body.body.trim() : "";
  if (text.length < 20) throw new HttpError("Write the contract text");
  return { title, body: text.slice(0, 50000) };
}

export async function sendContract(contract: any, actor: { name: string; role: string }) {
  contract.status = "Sent";
  contract.sentAt = new Date();
  await contract.save();
  return notifyClient(
    String(contract.client),
    {
      title: `Please sign: ${contract.title}`,
      body: `Agreement ${contract.number} is ready for your signature. Read it and sign online in under a minute.`,
      link: `/contract/${contract.publicId}`,
      button: "Review and sign",
      email: true,
    },
    actor
  );
}
