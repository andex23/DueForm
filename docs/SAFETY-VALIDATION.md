# Invoice safety validation

This branch adds 50 automated tests covering financial arithmetic, payment and
duplicate flows, guest/account storage separation, reminder eligibility, paginated
PDF exports, request authorization, database policies, token lookup/revocation,
email quotas, and ordered cloud uploads.

Run:

```
npm ci
npm test
npm run lint
npm run typecheck
npm run build
```

Email tests mock Resend and do not send live messages. SQL tests use disposable
embedded PostgreSQL with Supabase auth roles stubbed; they do not modify a hosted
project. The PDF tests check complete A4 slicing and integration with mocked
canvas/PDF adapters, not a browser-rendered visual snapshot.

Before production:

- Follow `supabase/SECURITY-MIGRATION.md`, including a two-user/anonymous staging
  check and real concurrent quota requests. Apply the database migration first.
- Set `APP_URL` to the HTTPS public origin and use a verified `INVOICE_FROM_EMAIL`.
- Reissue legacy share links, which are intentionally rejected by the new RPC.
- Review one-page and long invoices visually in a browser, including notes,
  payment instructions, logos, totals and mixed-currency dashboard summaries.
- Check real email delivery with a controlled recipient. No live delivery or
  browser visual QA has been performed for this change.

Limits: public links remain bearer capabilities; anyone with a link can view the
invoice's displayed customer and payment details. Quotas are per verified account,
not a global anti-abuse system. Uploads are ordered within one browser module;
concurrent tabs/devices still use last-write-wins cloud snapshots and may restore
stale data or sharing state. Do not edit the same workspace concurrently until
server-side revision/conflict protection is added. Extremely large PDF exports
remain subject to browser canvas-size limits.
