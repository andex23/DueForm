import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { sendInvoiceEmail } from "../sendInvoiceEmail";

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), maybeSingle: vi.fn(), rpc: vi.fn(), send: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({
  auth: { getUser: mocks.getUser }, rpc: mocks.rpc,
  from: () => ({ select: () => ({ eq: () => ({ maybeSingle: mocks.maybeSingle }) }) }),
}) }));
vi.mock("resend", () => ({ Resend: class { emails = { send: mocks.send }; } }));
const invoice = {
  id: "owned", invoiceNumber: "INV-001", status: "sent", currency: "USD",
  business: { name: "Studio", email: "studio@example.com", address: "", phone: "", website: "" },
  client: { name: "Client", email: "client@example.com", address: "", company: "" },
  lineItems: [{ id: "line", description: "Work", quantity: 1, rate: 100 }],
  taxRate: 0, adjustments: [], payments: [], notes: "", paymentTerms: "",
  paymentInfo: { methods: [], paymentLink: "", paymentNote: "" },
  dateIssued: "2026-11-01", dateDue: "2026-11-30", publicEnabled: true, publicToken: "secret",
  reminderRules: [{ id: "due", label: "Due", offsetDays: 0, enabled: true }],
};
const request = (body: unknown = { invoiceId: "owned", subject: "Invoice", message: "Hello" }, auth = true) => new NextRequest("https://attacker.invalid/api/send-invoice", {
  method: "POST", headers: { "Content-Type": "application/json", ...(auth ? { Authorization: "Bearer verified-token" } : {}) }, body: JSON.stringify(body),
});
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://db.example.com"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
  vi.stubEnv("INVOICE_FROM_EMAIL", "DueForm <billing@example.com>"); vi.stubEnv("RESEND_API_KEY", "test"); vi.stubEnv("APP_URL", "https://dueform.example.com");
  mocks.getUser.mockResolvedValue({ data: { user: { id: "owner", email: "owner@example.com", email_confirmed_at: "2026-01-01" } }, error: null });
  mocks.maybeSingle.mockResolvedValue({ data: { payload: { invoices: [invoice] } }, error: null });
  mocks.rpc.mockResolvedValue({ data: true, error: null }); mocks.send.mockResolvedValue({ data: { id: "delivery" }, error: null });
});
describe("invoice email authorization", () => {
  it("rejects anonymous requests before sending", async () => {
    expect((await sendInvoiceEmail(request(undefined, false), false)).status).toBe(401); expect(mocks.send).not.toHaveBeenCalled();
  });
  it("verifies token and confirmed account", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: new Error("bad token") });
    expect((await sendInvoiceEmail(request(), false)).status).toBe(401); expect(mocks.maybeSingle).not.toHaveBeenCalled();
  });
  it("rejects an unconfirmed account", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "owner", email: "owner@example.com" } }, error: null });
    expect((await sendInvoiceEmail(request(), false)).status).toBe(401);
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it("fails closed without configuration", async () => {
    vi.stubEnv("APP_URL", "");
    expect((await sendInvoiceEmail(request(), false)).status).toBe(503);
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it("rejects malformed JSON", async () => {
    const req = new NextRequest("https://dueform.example.com/api/send-invoice", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer token" }, body: "{" });
    expect((await sendInvoiceEmail(req, false)).status).toBe(400);
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it("does not trust an injected invoice or another owner's ID", async () => {
    expect((await sendInvoiceEmail(request({ invoiceId: "other", invoice, subject: "Invoice" }), false)).status).toBe(404); expect(mocks.send).not.toHaveBeenCalled();
  });
  it("rejects recipient overrides", async () => {
    expect((await sendInvoiceEmail(request({ invoiceId: "owned", subject: "Invoice", to: "victim@example.com" }), false)).status).toBe(400); expect(mocks.send).not.toHaveBeenCalled();
  });
  it("uses stored invoice, trusted origin, configured sender and verified reply-to", async () => {
    expect((await sendInvoiceEmail(request({ invoiceId: "owned", subject: "Invoice", invoice: { ...invoice, invoiceNumber: "FORGED" }, senderSettings: { fromEmail: "forged@example.com" } }), false)).status).toBe(200);
    expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({ from: "DueForm <billing@example.com>", replyTo: "owner@example.com", to: ["client@example.com"] }));
    const sent = mocks.send.mock.calls[0][0]; expect(sent.html).toContain("INV-001"); expect(sent.html).toContain("https://dueform.example.com/public/secret"); expect(sent.html).not.toContain("attacker.invalid"); expect(sent.html).not.toContain("FORGED");
  });
  it("fails closed if durable quota is unavailable", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: new Error("missing migration") });
    expect((await sendInvoiceEmail(request(), false)).status).toBe(503); expect(mocks.send).not.toHaveBeenCalled();
  });
  it("enforces quota for both email routes", async () => {
    mocks.rpc.mockResolvedValue({ data: false, error: null });
    for (const reminder of [false, true]) expect((await sendInvoiceEmail(request(), reminder)).status).toBe(429);
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it("rejects oversized input and header injection", async () => {
    expect((await sendInvoiceEmail(request({ invoiceId: "owned", subject: "bad\r\nBcc: victim@example.com" }), false)).status).toBe(400);
    expect((await sendInvoiceEmail(request({ invoiceId: "owned", subject: "Invoice", message: "x".repeat(17000) }), false)).status).toBe(400); expect(mocks.send).not.toHaveBeenCalled();
  });
  it("rejects disabled or unknown reminders and paid invoices", async () => {
    expect((await sendInvoiceEmail(request({ invoiceId: "owned", ruleId: "unknown" }), true)).status).toBe(400);
    mocks.maybeSingle.mockResolvedValue({ data: { payload: { invoices: [{ ...invoice, status: "paid" }] } } });
    expect((await sendInvoiceEmail(request(), true)).status).toBe(400); expect(mocks.send).not.toHaveBeenCalled();
  });
  it("does not report provider failure as sent or expose provider details", async () => {
    mocks.send.mockResolvedValue({ data: null, error: { message: "secret provider config" } });
    const response = await sendInvoiceEmail(request(), false); expect(response.status).toBe(502); expect(await response.text()).not.toContain("secret provider config");
  });
});
