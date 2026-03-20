# DueForm

DueForm is a premium invoice workspace built with Next.js. It helps freelancers, studios, and small teams create polished invoices, send them by email, share public invoice links, and track payment status from a dark editorial interface.

## Highlights

- Create branded invoices with sender details, client details, tax, due dates, currencies, and optional logo upload
- Save clients and reusable services for faster invoice creation
- Duplicate invoices and automatically mark overdue invoices
- Track partial payments, balances, and payment history
- Support multiple payment methods including bank transfer, PayPal, and crypto
- Send invoices and reminders with Resend
- Share public invoice links for mobile-friendly viewing
- Use guest mode locally or sign in for cloud sync with Supabase
- Switch between three premium dark themes

## Stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- Supabase for auth and cloud sync
- Resend for email delivery
- jsPDF and html2canvas-pro for PDF export

## Running Locally

1. Install dependencies:

```bash
npm install
```

2. Copy the example environment file and fill in your values:

```bash
cp .env.example .env.local
```

3. Start the development server:

```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

Add these values to `.env.local`:

```env
RESEND_API_KEY=
INVOICE_FROM_EMAIL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Notes:

- `RESEND_API_KEY` is required for live invoice and reminder sending.
- `INVOICE_FROM_EMAIL` should be a sender Resend allows.
- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` enable multi-user auth and cloud sync.
- If Supabase is not configured, the app still works in guest mode with browser storage only.

## Supabase Setup

Apply the SQL in [`supabase/schema.sql`](./supabase/schema.sql) to your Supabase project before using:

- cloud workspace sync
- public invoice links
- multi-user account storage

The app expects email auth to be enabled in Supabase.

## Email Delivery

DueForm uses Resend through:

- `src/app/api/send-invoice/route.ts`
- `src/app/api/send-reminder/route.ts`

Users can enter sender name and sender email manually in the app. Delivery still depends on that sender being valid for the configured Resend account.

## Scripts

```bash
npm run dev
npm run lint
npm run build
npm run start
```

## Deploying

DueForm deploys cleanly on Vercel.

Before deploying, make sure the Vercel project has the same environment variables listed above. For production multi-user access, also make sure your Supabase project has the schema from `supabase/schema.sql`.

## Project Structure

```text
src/app              App routes
src/components       UI components and workspace shell
src/lib              Data model, storage, themes, helpers, cloud sync
supabase/schema.sql  Required database schema for cloud features
```

## Status

The current build passes:

- `npm run lint`
- `npm run build`
