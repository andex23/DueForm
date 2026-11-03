# Sharing and email safety upgrade

Apply `migrations/20261103_secure_sharing_and_email.sql` to an existing Supabase
project before deploying the matching application code. For a new project,
`schema.sql` includes the same changes. Both scripts can be reapplied. Review and
apply through your normal database migration process; this change does not apply
itself or require an application service-role key.

The migration removes anonymous table reads. Anonymous callers can only retrieve
one invoice with `get_public_invoice(share_token)` and must possess its exact
link. The function checks the owner's current workspace for a matching enabled
share, so a stale public index row cannot bypass a successfully synced revocation.
It returns invoice presentation fields, not workspace data, delivery logs,
reminder logs, internal identifiers, or payment history notes. A public invoice
still intentionally includes its customer details and payment instructions:
anyone holding the link can view them. Legacy non-cryptographic links intentionally stop resolving after this upgrade.
Use the app to publish/copy a new link and resend it to intended recipients. New
links use cryptographic UUIDv4 tokens; disable sharing if a link is disclosed.

`claim_invoice_email_slot(invoice_id)` requires authentication, checks the saved
invoice belongs to the caller, and atomically reserves a send attempt. The quota
is ten attempts per user in a rolling hour and one per invoice per minute. Failed
provider calls also consume quota. Direct reads/writes of quota records are not
granted to API roles. Old claims for an active user are cleaned on their next
attempt. No automatic sends or live emails are part of the migration.

Before production, verify using two test users and an anonymous client:

1. Anonymous table listing is denied; authenticated listing only returns own rows.
2. The exact enabled token returns its invoice; unknown/revoked tokens return null.
3. A second user cannot modify another user's workspace or share rows.
4. Removing/disabling a share in the workspace makes its old token unavailable,
   even if its index row remains temporarily.
5. Anonymous quota calls are denied. A user cannot claim another user's invoice.
6. Concurrent claims for one invoice allow one call per minute. Claims for eleven
   distinct owned invoices allow ten per hour, including across app instances.

The repository's SQL regression test uses disposable embedded PostgreSQL (PGlite)
with the Supabase `auth` roles/schema stubbed. It does not send email. Never run
that fixture against a production database.

## Concurrent edits

Within one running browser client, uploads are queued in invocation order,
including after failures. This prevents overlapping auto-sync and explicit
sharing/payment updates from arriving at the server out of order. The existing
workspace-snapshot architecture still uses last-write-wins across separate tabs
or devices. A stale snapshot from another tab/device can overwrite newer payment
changes or re-enable an old share. Until server-side version conflict handling is
added, use one active editing session and refresh other sessions before editing.
The revocation check always follows the latest saved workspace state.
