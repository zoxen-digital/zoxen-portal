# Zoxen Digital — Client & Invoice Manager

Next.js 15 + MongoDB (Mongoose) + Tailwind CSS 4. Light theme by default, with a light/dark toggle.

## Setup

1. Copy `.env.example` to `.env.local` and fill in the values:
   - `MONGODB_URI` — your MongoDB / Atlas connection string
   - `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` — the login for the dashboard
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
| Queries / Projects | Every client request with status (Pending, In Progress, Completed, Closed), owner, due date, overdue flag |
| Onboarding Submissions | Leads from the onboarding form; review and convert to client + pending query in one click |
| Invoices | Create invoice (requirement, websites/pages, line items, extra costs, discount, tax, advance), share link, record payments |
| Reports | Invoiced vs collected per month, outstanding invoices, team workload, top clients, queries by service |
| Settings | Company details, invoice prefix/currency/tax defaults, bank details, team members |

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
