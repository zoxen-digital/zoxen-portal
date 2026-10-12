/**
 * Legal pages (Privacy, Terms, Refund, Data Deletion). Single source of truth:
 * the portal renders these at /privacy, /terms, /refund-policy and /data-deletion,
 * and the marketing website copies the same text. Update the date when the text changes.
 */

export const COMPANY = {
  name: "Zoxen Digital",
  email: "support@zoxendigital.com",
  website: "https://zoxendigital.com",
  portal: "the Zoxen Digital client portal",
  law: "the State of Wyoming, United States",
  updated: "October 12, 2026",
};

export type LegalSection = { h: string; p?: string[]; list?: string[]; after?: string[] };
export type LegalDoc = { slug: string; title: string; summary: string; sections: LegalSection[] };

const C = COMPANY;

export const PRIVACY: LegalDoc = {
  slug: "privacy",
  title: "Privacy Policy",
  summary: `How ${C.name} collects, uses and protects your information when you use our website, client portal, forms, chat and messaging channels.`,
  sections: [
    {
      h: "Who we are",
      p: [
        `${C.name} ("we", "us", "our") is a digital agency that provides website and app development, digital marketing, advertising, SEO, branding, automation and AI services (including chatbots and calling agents). This policy applies to ${C.website}, ${C.portal}, and any form, chat or messaging channel we operate.`,
        `If you have any question about this policy, contact us at ${C.email}.`,
      ],
    },
    {
      h: "Information we collect",
      p: ["We only collect what we need to talk to you, deliver our services and get paid."],
      list: [
        "Contact details you give us: name, business name, email, phone or WhatsApp number, and the message you send through our forms.",
        "Project information: business details, goals, brand files, logins you choose to share for the work, content, images and other files you upload in the onboarding form or portal.",
        "Account information for the client portal: name, email, password (stored encrypted, we cannot read it) and the device and browser used to sign in.",
        "Billing information: invoices, amounts, payment status and payment method type. Card details are handled by the payment provider and are never stored on our systems.",
        "Messages: chat in the client portal, and messages you send to our Facebook Page, Instagram account or WhatsApp business number, if we connect those channels.",
        "Technical data: IP address, approximate location (country/city), device type, pages visited and cookies, used for security, sign-in alerts and analytics.",
      ],
    },
    {
      h: "How we use your information",
      list: [
        "To reply to your enquiry and send you quotes, proposals and contracts.",
        "To deliver the services you buy, manage your project and keep you updated.",
        "To create and send invoices, record payments and send payment reminders.",
        "To provide the client portal, chat and notifications (in-app, email and push).",
        "To keep accounts secure: sign-in records, new-device alerts and fraud prevention.",
        "To measure and improve our website and advertising (for example, with Meta Pixel and analytics).",
        "To meet legal, tax and accounting obligations.",
      ],
      after: ["We do not sell your personal information. We do not use your project files or client data for anything other than delivering your work."],
    },
    {
      h: "Messages from Facebook, Instagram and WhatsApp",
      p: [
        "If you message our Facebook Page, Instagram account or WhatsApp business number, Meta Platforms shares that message, your public profile name and your profile ID with us so our team can read and reply to it inside our portal.",
        "We use these messages only to reply to you and to follow up on your enquiry. We do not use them for unrelated purposes and we do not share them with anyone outside our team and the service providers listed below.",
        `You can ask us to delete these messages at any time. See our Data Deletion page at ${C.website}/data-deletion.`,
      ],
    },
    {
      h: "Who we share information with",
      p: ["We share information only with service providers that help us run our business, and only as much as they need:"],
      list: [
        "Hosting and infrastructure (for example, Vercel) and our database provider (MongoDB Atlas).",
        "File storage for uploads (Vercel Blob).",
        "Email and notification services used to send you messages and alerts.",
        "Google (for example, Google Calendar and Google Meet when we schedule meetings) and Meta (Facebook, Instagram, WhatsApp) when you contact us there.",
        "Payment providers and banks that process your payments.",
        "Professional advisers (accountants, lawyers) or authorities when required by law.",
      ],
      after: ["Each provider is bound by its own privacy and security terms. Some providers may process data outside your country, including in the United States."],
    },
    {
      h: "Cookies and analytics",
      p: [
        "We use essential cookies to keep you signed in to the portal and remember settings such as light or dark mode. Our website may use analytics and advertising cookies (such as Meta Pixel) to understand visits and measure ads.",
        "You can block or delete cookies in your browser settings. The portal will not work without its essential sign-in cookie.",
      ],
    },
    {
      h: "How long we keep information",
      list: [
        "Enquiries that do not become projects: up to 2 years, then deleted.",
        "Client projects, files and chat: for the length of our relationship and up to 3 years after, unless you ask us to delete them earlier.",
        "Invoices and payment records: as long as tax and accounting laws require (usually up to 7 years).",
        "Security records (sign-in history, audit logs): up to 1 year.",
        "Deleted items stay in our recycle bin for 30 days and are then permanently removed.",
      ],
    },
    {
      h: "How we protect information",
      p: [
        "We use encrypted connections (HTTPS), encrypted passwords, role-based access so team members only see what they need, sign-in alerts, audit logs and regular backups. No system is 100% secure, but we work to protect your data and will tell you without undue delay if a breach affects you.",
      ],
    },
    {
      h: "Your rights",
      p: ["Depending on where you live, you may have the right to:"],
      list: [
        "Ask what personal information we hold about you and get a copy.",
        "Ask us to correct information that is wrong.",
        "Ask us to delete your information (see our Data Deletion page).",
        "Opt out of marketing emails at any time (use the unsubscribe link or email us).",
        "Object to or limit certain uses of your information.",
      ],
      after: [`To use any of these rights, email ${C.email}. We reply within 30 days. We will not treat you differently for using your rights.`],
    },
    {
      h: "Children",
      p: ["Our services are for businesses and adults. We do not knowingly collect information from children under 13. If you believe a child has sent us information, contact us and we will delete it."],
    },
    {
      h: "Changes to this policy",
      p: ["We may update this policy from time to time. The date at the top shows the latest version. If a change is important, we will let active clients know by email or in the portal."],
    },
    {
      h: "Contact",
      p: [`${C.name}`, `Email: ${C.email}`, `Website: ${C.website}`],
    },
  ],
};

export const TERMS: LegalDoc = {
  slug: "terms",
  title: "Terms of Service",
  summary: `The terms that apply when you use our website and client portal, or buy services from ${C.name}.`,
  sections: [
    {
      h: "Agreement",
      p: [
        `These Terms of Service ("Terms") are an agreement between you and ${C.name}. By using ${C.website}, ${C.portal}, or by accepting a quote, proposal, contract or invoice from us, you agree to these Terms. If a signed contract or accepted proposal says something different, the contract or proposal applies for that project.`,
      ],
    },
    {
      h: "Our services",
      p: [
        "We provide website and app development, e-commerce, digital marketing, Meta and Google advertising management, SEO, social media, content and video, branding, CRM and automation, and AI tools such as chatbots and calling agents. What is included in your project (scope, pages, features, revisions and timeline) is described in your quote, proposal, package or contract.",
      ],
    },
    {
      h: "Quotes, proposals and contracts",
      list: [
        "Quotes are valid until the date shown on them.",
        "A project starts after you accept the quote or sign the contract and the first payment is received.",
        "Work outside the agreed scope is a change request. We will tell you the extra cost and time before doing it.",
      ],
    },
    {
      h: "Payments",
      list: [
        "Invoices are due by the due date shown on the invoice.",
        "Monthly services (such as SEO, ads management or maintenance) are billed in advance for each month and renew automatically until cancelled.",
        "Late invoices may pause work, and we may send automatic reminders.",
        "Third-party costs (domains, hosting, software licences, paid plugins, stock media and advertising spend) are paid by you, either directly or through us, and are separate from our fees unless the quote says otherwise.",
        "Refunds follow our Refund & Cancellation Policy.",
      ],
    },
    {
      h: "Your responsibilities",
      list: [
        "Give us accurate information and the content, files and access we need, on time. Delays on your side can move the timeline.",
        "Make sure you have the rights to any content, logos, images and data you give us.",
        "Review and approve work in the client portal within a reasonable time.",
        "Keep your portal password safe and tell us if you think someone else used your account.",
      ],
    },
    {
      h: "Revisions and approval",
      p: [
        "Each package or quote includes a set number of revision rounds. Extra rounds are billed as a change request. When you approve work in the portal, or do not respond within 14 days of delivery, the work is treated as accepted.",
      ],
    },
    {
      h: "Ownership",
      list: [
        "Once your project is paid in full, you own the final designs, website content and deliverables made for you.",
        "We keep ownership of our own tools, code libraries, templates and know-how, and give you a lasting licence to use them as part of your project.",
        "Third-party items (themes, plugins, fonts, stock images, platforms) stay under their own licences.",
        "We may show your project in our portfolio unless you ask us in writing not to.",
      ],
    },
    {
      h: "Results and advertising",
      p: [
        "We work hard to get results, but we cannot guarantee specific rankings, traffic, leads, sales or ad performance, because these depend on platforms, competition, budget and your market. Ad platforms (Meta, Google and others) set their own rules and may reject ads or limit accounts; we are not responsible for their decisions.",
      ],
    },
    {
      h: "AI chatbots and calling agents",
      p: [
        "AI tools answer based on the information you give us and can make mistakes. You are responsible for checking the information they use, and for following the laws on recording, calling and messaging customers that apply to your business. Ongoing AI usage costs (for example, calls, minutes or messages charged by providers) may be billed separately.",
      ],
    },
    {
      h: "Client portal",
      p: [
        "We provide the client portal to share projects, files, invoices and chat. We may update or improve it at any time. Do not misuse it, try to access other clients' data, or upload harmful files. We may suspend access that puts other users or our systems at risk.",
      ],
    },
    {
      h: "Confidentiality",
      p: ["We keep your business information and logins confidential and only use them to do your work. Please keep our pricing, proposals and internal documents confidential too."],
    },
    {
      h: "Cancellation and ending the work",
      p: [
        "You can cancel monthly services before the next billing date. Either side can end a project in writing if the other side seriously breaks these Terms and does not fix it within 14 days. You pay for work completed up to the end date, under our Refund & Cancellation Policy.",
      ],
    },
    {
      h: "Limitation of liability",
      p: [
        `To the extent the law allows, ${C.name} is not liable for indirect or consequential losses such as lost profits, lost data or business interruption. Our total liability for any claim is limited to the amount you paid us for the specific service in the 3 months before the claim.`,
      ],
    },
    {
      h: "Governing law",
      p: [`These Terms are governed by the laws of ${C.law}. We will always try to solve any disagreement by talking first. If that does not work, disputes will be handled by the courts of the State of Wyoming.`],
    },
    {
      h: "Changes",
      p: ["We may update these Terms. The date at the top shows the latest version. Changes do not affect projects already agreed unless both sides agree."],
    },
    { h: "Contact", p: [`Questions about these Terms: ${C.email}`] },
  ],
};

export const REFUND: LegalDoc = {
  slug: "refund-policy",
  title: "Refund & Cancellation Policy",
  summary: `When ${C.name} gives refunds, how to cancel, and what cannot be refunded.`,
  sections: [
    {
      h: "Full refund within 7 days",
      p: [
        "If you change your mind, you can get a full refund if you ask within 7 days of your payment and we have not started work on your project yet. Work starts when we begin the onboarding, design, development, setup or campaign for you.",
      ],
    },
    {
      h: "After work has started or after 7 days",
      list: [
        "Payments are not refundable once work has started, or after 7 days from payment.",
        "If a project ends early, you keep everything completed and paid for. If you prepaid for work we have not done yet, we may refund that unused part at our discretion.",
        "If we cannot deliver what was agreed because of a problem on our side, we will either fix it or refund the part that was not delivered.",
      ],
    },
    {
      h: "Monthly services",
      list: [
        "Monthly services (SEO, ads management, social media, maintenance and similar) can be cancelled any time before the next billing date. Email us or message us in the portal.",
        "Cancelling stops future charges. The current month already paid is not refunded, and the service continues until the end of that month.",
        "One-time setup fees are covered by the 7-day rule above.",
      ],
    },
    {
      h: "Never refundable",
      list: [
        "Advertising spend paid to Meta, Google or other platforms.",
        "Third-party costs: domains, hosting, software licences, paid plugins, stock media, phone numbers and AI usage charges.",
        "Custom work you have approved in the portal.",
      ],
    },
    {
      h: "How to request a refund",
      p: [
        `Email ${C.email} (or message us in the client portal) with your name, invoice number and the reason. We reply within 2 business days. Approved refunds go back to the original payment method within 10 business days; your bank may take longer to show it.`,
      ],
    },
    {
      h: "Payment disputes",
      p: ["Please contact us before opening a chargeback or dispute with your bank. Most issues are solved quickly by talking to us."],
    },
  ],
};

export const DATA_DELETION: LegalDoc = {
  slug: "data-deletion",
  title: "Data Deletion",
  summary: `How to ask ${C.name} to delete your personal data, including data received through Facebook, Instagram or WhatsApp.`,
  sections: [
    {
      h: "How to request deletion",
      p: ["You can ask us to delete your personal data at any time:"],
      list: [
        `Email ${C.email} with the subject "Delete my data".`,
        "Include your name and the email, phone number or Facebook/Instagram name you used to contact us, so we can find your data.",
        "If you have a client portal account, you can also send the request from the chat in the portal.",
      ],
    },
    {
      h: "Data from Facebook, Instagram and WhatsApp",
      p: [
        "If you contacted us through our Facebook Page, Instagram account or WhatsApp business number, we store your messages, public profile name and profile ID in our portal so we can reply to you. Ask us using the steps above and we will delete them.",
        "You can also remove our access from Facebook: go to Settings & privacy, then Settings, then Apps and websites, find our app, and choose Remove. Then send us a deletion request so we also delete what we already received.",
      ],
    },
    {
      h: "What happens next",
      list: [
        "We confirm your request within 3 business days and may ask you to verify that the data is yours.",
        "We delete your data from our active systems within 30 days.",
        "Deleted data is fully removed from backups and our recycle bin within a further 30 days.",
        "We email you when deletion is complete.",
      ],
    },
    {
      h: "What we may need to keep",
      p: [
        "We may keep invoices and payment records for as long as tax and accounting laws require, and the minimum information needed to show we completed your request. This information is not used for anything else.",
      ],
    },
    { h: "Contact", p: [`${C.name} · ${C.email} · ${C.website}`] },
  ],
};

export const LEGAL_DOCS = [PRIVACY, TERMS, REFUND, DATA_DELETION];
