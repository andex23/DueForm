import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { buildInvoiceEmailHtml, buildReminderMessage, buildReminderSubject } from "./emailTemplates";
import { calculateBalance } from "./helpers";
import { Invoice, WorkspaceSnapshot } from "./types";

const MAX_BODY_BYTES = 16_384;
const emailPattern = /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/;
const fail = (status: number, error: string) =>
  NextResponse.json({ success: false, error }, { status });

async function readBody(req: NextRequest): Promise<Record<string, unknown>> {
  if (!req.headers.get("content-type")?.startsWith("application/json")) throw new Error("Invalid request");
  const reader = req.body?.getReader();
  if (!reader) throw new Error("Invalid request");
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY_BYTES) {
      await reader.cancel();
      throw new Error("Request too large");
    }
    chunks.push(value);
  }
  const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Invalid request");
  return body;
}

/** Both delivery endpoints use the authenticated owner's stored invoice, never a request invoice. */
export async function sendInvoiceEmail(req: NextRequest, reminder: boolean) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const from = process.env.INVOICE_FROM_EMAIL;
  const apiKey = process.env.RESEND_API_KEY;
  const appUrl = process.env.APP_URL;
  if (!url || !key || !from || !apiKey || !appUrl) return fail(503, "Email delivery is not configured");

  const authorization = req.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return fail(401, "Sign in to send email");
  const token = authorization.slice(7);
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  try {
    // getUser verifies the JWT with Supabase; a decoded JWT/session is not sufficient.
    const { data: { user }, error: authError } = await client.auth.getUser(token);
    if (authError || !user || !user.email_confirmed_at || !user.email) return fail(401, "Sign in with a verified email to send invoices");

    let body: Record<string, unknown>;
    try { body = await readBody(req); } catch { return fail(400, "Invalid or oversized email request"); }
    if (typeof body.invoiceId !== "string" || body.invoiceId.length > 128) return fail(400, "Invoice ID is required");
    const { data, error } = await client.from("invoice_workspaces").select("payload").eq("user_id", user.id).maybeSingle();
    if (error) return fail(503, "Unable to load invoice");
    const snapshot = data?.payload as WorkspaceSnapshot | undefined;
    const invoice: Invoice | undefined = snapshot?.invoices?.find((item) => item.id === body.invoiceId);
    if (!invoice) return fail(404, "Invoice not found");
    const to = invoice.client?.email?.trim();
    if (!to || to.length > 254 || !emailPattern.test(to)) return fail(400, "Save a valid client email on the invoice first");
    if (body.to !== undefined && body.to !== to) return fail(400, "Recipient must match the saved invoice client");
    let rule;
    if (reminder && body.ruleId !== undefined) {
      rule = invoice.reminderRules?.find((item) => item.id === body.ruleId && item.enabled);
      if (!rule) return fail(400, "Reminder rule not found or disabled");
    }
    if (reminder && (invoice.status === "draft" || invoice.status === "paid" || calculateBalance(invoice.lineItems, invoice.taxRate, invoice.payments, invoice.adjustments) <= 0)) {
      return fail(400, "Only unpaid sent invoices can receive reminders");
    }
    const subject = reminder ? buildReminderSubject(invoice, rule) : body.subject;
    const message = reminder ? buildReminderMessage(invoice, rule) : (body.message ?? "");
    if (typeof subject !== "string" || !subject.trim() || subject.length > 200 || /[\r\n]/.test(subject) || typeof message !== "string" || message.length > 10_000) return fail(400, "Invalid subject or message");
    const origin = new URL(appUrl);
    if (origin.protocol !== "https:" && !(origin.protocol === "http:" && origin.hostname === "localhost")) return fail(503, "Email delivery is not configured");
    const publicUrl = invoice.publicEnabled && invoice.publicToken
      ? new URL(`/public/${encodeURIComponent(invoice.publicToken)}`, origin).toString()
      : undefined;
    const html = buildInvoiceEmailHtml(invoice, message, publicUrl);
    // Atomic database quota shared across serverless instances. Fail closed if migration is missing.
    const { data: allowed, error: quotaError } = await client.rpc("claim_invoice_email_slot", { invoice_id: invoice.id });
    if (quotaError) return fail(503, "Email sending is temporarily unavailable");
    if (allowed !== true) return fail(429, "Email limit reached. Please try again later");
    const { data: delivery, error: deliveryError } = await new Resend(apiKey).emails.send({
      from, to: [to], subject: subject.trim(), text: message, html,
      replyTo: user.email,
    });
    if (deliveryError) return fail(502, "Email delivery failed. Please try again later");
    return NextResponse.json({ success: true, emailId: delivery?.id, subject: subject.trim(), message });
  } catch {
    return fail(500, "Unable to send email");
  }
}
