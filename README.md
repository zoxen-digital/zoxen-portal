# Zoxen Digital — Client & Invoice Manager

Next.js 15 + MongoDB (Mongoose) + Tailwind CSS 4. Light theme by default, with a light/dark toggle.

## Setup

1. Copy `.env.example` to `.env.local` and fill in the values:
   - `MONGODB_URI` — your MongoDB / Atlas connection string
   - `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` — creates the first Super Admin on first login (and stays as a recovery login)
   - `SMTP_USER`, `SMTP_PASS` — Gmail address + App Password for invite and notification emails (optional)
   - `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` — for phone/desktop push; generate with `npx web-push generate-vapid-keys`
   - `AUTH_SECRET` — a long random string (32+ characters)
   - `NEXT_PUBLIC_APP_URL` — the live domain (used in invoice share links)
   - `ONBOARDING_API_KEY` — secret key your onboarding website sends
2. Install and run:
   ```bash
   npm install
   npm run dev        # http://localhost:3000
   ```
3. Production: `npm run build` then `npm start` (or deploy to Vercel and add the same env vars).

If you use MongoDB Atlas, allow your server's IP under **Network Access**.

## Modules

| Page | What it does |
| --- | --- |
| Dashboard | KPIs, monthly revenue, query status breakdown, recent queries and invoices |
| Clients | Client list, search, status, totals invoiced / balance; detail page with queries and invoices |
| Projects | Stages (Onboarding → Approved → In Progress → Internal Review → Client Review → Revision → Launch → Live → Completed, plus On Hold / Blocked), progress, checklist, issues & blockers, revisions, documents, client update, internal notes, activity log |
| Team & Portal Users | Add Super Admins, Team Admins and client logins; invite / reset links; disable or delete |
| Queries | Every client request with status (Pending, In Progress, Completed, Closed), owner, due date, overdue flag |
| Onboarding Submissions | Leads from the onboarding form; review and convert to client + pending query in one click |
| Invoices | Create invoice (requirement, websites/pages, line items, extra costs, discount, tax, advance), share link, record payments |
| Reports | Invoiced vs collected per month, outstanding invoices, team workload, top clients, queries by service |
| Settings | Company details, invoice prefix/currency/tax defaults, bank details, team members |

## Roles

| Role | Sees |
| --- | --- |
| Super Admin | Everything |
| Team Admin | Only projects they are assigned to and queries assigned to their name. No invoices, revenue, reports, clients list or settings |
| Client | `/portal` only: their projects (client-friendly stage names), approve / request changes, revisions, shared documents, meetings, invoices, feedback |

Adding a user sends a one-time "set your password" link (emailed if SMTP is set, otherwise shown to copy and send on WhatsApp).

## Client portal flow

1. Team moves a project to **Client Review** (add the preview link first) → client gets an in-app, push and email alert.
2. Client clicks **Approve** (project moves to Launch) or **Request changes** (new revision round, project moves to Revision). Rounds beyond the package limit are flagged as extra.
3. Issues marked "Show to client" appear on the portal as **Action needed** (e.g. "Please send your logo").
4. After Live / Completed the client can leave a 1–5 rating.

## Notifications

In-app bell for everyone, free phone/desktop push (each person turns it on under the bell or My account; on iPhone, add the site to the Home Screen first), and branded emails through Gmail SMTP for the important moments (ready for review, approved, changes requested, action needed, live, invites).

## Client invoice link

Each invoice gets a private link: `/invoice/<random-id>` — opens without login.
- Draft and cancelled invoices are hidden from the link.
- Client can **Download PDF / Print** and click **Confirm & Pay**.
- The admin sees view count, last viewed date and confirmation.
- Share buttons: copy link, WhatsApp, email.

## Connecting the onboarding form (later)

`POST {NEXT_PUBLIC_APP_URL}/api/onboarding/submit` with header `x-api-key: <ONBOARDING_API_KEY>`.
Accepts JSON or form data. Fields: `name` (required), `email`, `phone`, `company`, `website`,
`services` (array or comma separated), `budget`, `message`. Any extra fields are stored as well.
A copy-paste example is on the Onboarding Submissions page.

## Logo

The logo is drawn as SVG in `src/components/Logo.tsx` so it adapts to light and dark mode.
To use the official file instead, add it to `public/` and swap the `<LogoMark />` for an `<img>`.

## Sales, support and automation

| Feature | Where | What it does |
| --- | --- | --- |
| Project chat + files | Project page / portal project page | Client and team talk inside the project; files upload to Vercel Blob (25 MB max) |
| Support tickets | `/tickets`, portal → Support | Bugs / change requests with priority, owner and due date; client can close or reopen |
| Packages | `/packages`, client page → Start a package | Ready-made offers: one click creates a quote, or a project (checklist, timeline) + invoice |
| Quotes | `/quotes`, public `/quote/<id>` | Client accepts online by typing their name; creates the project and invoice automatically |
| Contracts | `/contracts`, public `/contract/<id>` | E-sign with name, time, IP and browser recorded; template in Settings |
| Recurring invoices | `/recurring` | Monthly / quarterly / yearly billing created and sent automatically |
| My Day | `/today` | Overdue, due today, waiting on you, waiting on client, today's meetings |
| Monthly report | Client page → Monthly Report, portal → Reports | Work done, revisions, invoices and payments for a month; PDF or send to client |
| Daily job | `/api/cron/daily` (09:00 PKT) | Recurring invoices, overdue reminders (3/7/14 days), review reminders, meeting reminders, quote expiry, team morning digest |
