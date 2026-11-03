import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Disposable embedded PostgreSQL only. No Supabase credentials or live requests.
const db = new PGlite();
const alice = "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa";
const bob = "bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb";
const token = "inv_aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa";
const bobToken = "inv_bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb";
const schema = readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8");
const migration = readFileSync(new URL("../supabase/migrations/20261103_secure_sharing_and_email.sql", import.meta.url), "utf8");

async function asUser(role: "anon" | "authenticated", user = "") {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [user]);
  await db.exec(`set role ${role}`);
}

function invoice(id: string, shareToken?: string) {
  return {
    id, invoiceNumber: `INV-${id}`, businessId: "private-business-id",
    business: { id: "private-business-id", isDefault: true, name: "Studio" },
    client: { id: "private-client-id", name: "Client" },
    lineItems: [], taxRate: 0, notes: "Invoice note", paymentTerms: "Net 30",
    paymentInfo: { methods: [], paymentLink: "", paymentNote: "" },
    payments: [{ id: "private-payment", amount: 10, note: "Private reconciliation note" }],
    currency: "USD", status: "sent", dateIssued: "2026-11-01", dateDue: "2026-12-01",
    publicToken: shareToken, publicEnabled: Boolean(shareToken),
    emailDelivery: { lastError: "private-provider-detail" },
    reminderHistory: [{ to: "private@example.test" }],
  };
}

beforeAll(async () => {
  await db.exec(`
    create role anon;
    create role authenticated;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
    insert into auth.users values ('${alice}'), ('${bob}');
  `);
  await db.exec(schema);
  // Supabase grants these API table privileges by default; RLS remains the gate.
  await db.exec("grant select, insert, update on public.invoice_workspaces to authenticated");
  await db.query("insert into public.invoice_workspaces(user_id, payload) values ($1, $2), ($3, $4)", [
    alice, JSON.stringify({ invoices: Array.from({ length: 12 }, (_, index) => invoice(`alice-${index}`, index === 0 ? token : undefined)) }),
    bob, JSON.stringify({ invoices: [invoice("bob-0", bobToken)] }),
  ]);
  await db.query("insert into public.public_invoices(token, owner_id, invoice) values ($1, $2, $3), ($4, $5, $6)", [
    token, alice, JSON.stringify(invoice("alice-0", token)),
    bobToken, bob, JSON.stringify(invoice("bob-0", bobToken)),
  ]);
}, 30_000);
afterAll(async () => { await db.close(); });

describe("database sharing and email boundaries", () => {
  it("can reapply the security migration and full bootstrap", async () => {
    await db.exec(migration);
    await db.exec(schema);
  });

  it("denies anonymous invoice enumeration and email quota access", async () => {
    await asUser("anon");
    await expect(db.query("select * from public.public_invoices")).rejects.toThrow(/permission denied/);
    await expect(db.query("select public.claim_invoice_email_slot('alice-0')")).rejects.toThrow(/permission denied/);
    await expect(db.query("select * from public.invoice_email_claims")).rejects.toThrow(/permission denied/);
  });

  it("returns only the exact shared invoice without private metadata", async () => {
    await asUser("anon");
    const { rows } = await db.query<{ invoice: Record<string, unknown> }>("select public.get_public_invoice($1) as invoice", [token]);
    expect(rows[0].invoice.invoiceNumber).toBe("INV-alice-0");
    expect(rows[0].invoice.emailDelivery).toBeUndefined();
    expect(rows[0].invoice.reminderHistory).toBeUndefined();
    expect(rows[0].invoice.business).toEqual({ name: "Studio" });
    expect(rows[0].invoice.client).toEqual({ name: "Client" });
    expect(rows[0].invoice.payments).toEqual([{ amount: 10 }]);
    expect((await db.query<{ invoice: unknown }>("select public.get_public_invoice('unknown-token-value') as invoice")).rows[0].invoice).toBeNull();
  });

  it("invalidates legacy weak sharing tokens even when still stored and enabled", async () => {
    await db.exec("reset role");
    const legacyToken = "inv_legacy_12345678";
    await db.query("update public.invoice_workspaces set payload = jsonb_set(payload, '{invoices,0,publicToken}', to_jsonb($1::text)) where user_id = $2", [legacyToken, alice]);
    await db.query("insert into public.public_invoices(token, owner_id, invoice) values ($1, $2, $3)", [legacyToken, alice, JSON.stringify(invoice("alice-0", legacyToken))]);
    await asUser("anon");
    expect((await db.query<{ invoice: unknown }>("select public.get_public_invoice($1) as invoice", [legacyToken])).rows[0].invoice).toBeNull();
    await db.exec("reset role");
    await db.query("delete from public.public_invoices where token = $1", [legacyToken]);
    await db.query("update public.invoice_workspaces set payload = jsonb_set(payload, '{invoices,0,publicToken}', to_jsonb($1::text)) where user_id = $2", [token, alice]);
  });

  it("restricts workspace and public rows to the authenticated owner", async () => {
    await asUser("authenticated", bob);
    expect((await db.query("select * from public.public_invoices")).rows).toHaveLength(1);
    expect((await db.query("select * from public.invoice_workspaces")).rows).toHaveLength(1);
    expect((await db.query("update public.public_invoices set invoice = '{}' where owner_id = $1 returning token", [alice])).rows).toHaveLength(0);
    await expect(db.query("select public.claim_invoice_email_slot('alice-0')")).rejects.toThrow(/Invoice unavailable/);
    await expect(db.query("delete from public.invoice_email_claims")).rejects.toThrow(/permission denied/);
  });

  it("revokes access from current workspace even if a stale index row remains", async () => {
    await asUser("authenticated", alice);
    await db.query("update public.invoice_workspaces set payload = jsonb_set(payload, '{invoices,0,publicEnabled}', 'false') where user_id = $1", [alice]);
    await asUser("anon");
    expect((await db.query<{ invoice: unknown }>("select public.get_public_invoice($1) as invoice", [token])).rows[0].invoice).toBeNull();
  });

  it("enforces per-invoice cooldown and per-user rolling quota", async () => {
    await asUser("authenticated", alice);
    const claim = async (id: string) => (await db.query<{ allowed: boolean }>("select public.claim_invoice_email_slot($1) as allowed", [id])).rows[0].allowed;
    expect(await claim("alice-0")).toBe(true);
    expect(await claim("alice-0")).toBe(false);
    for (let index = 1; index < 10; index++) expect(await claim(`alice-${index}`)).toBe(true);
    expect(await claim("alice-10")).toBe(false);
    await asUser("authenticated", bob);
    expect(await claim("bob-0")).toBe(true);
    await db.exec("reset role");
    await db.query("update public.invoice_email_claims set claimed_at = now() - interval '2 hours' where user_id = $1", [alice]);
    await asUser("authenticated", alice);
    expect(await claim("alice-10")).toBe(true);
  });
});
