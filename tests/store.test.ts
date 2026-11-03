import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { invoice } from "./fixtures";
import { addPayment, removePayment, saveInvoice, getInvoice, getInvoices, duplicateInvoice, exportWorkspaceData, importWorkspaceData, markOverdueInvoices } from "../src/lib/store";
import { setGuestModeEnabled } from "../src/lib/cloud";

function storage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: key => { values.delete(key); },
    clear: () => { values.clear(); },
    key: index => [...values.keys()][index] ?? null,
  };
}
const payment = (amount: number, id = "payment-1") => ({ id, amount, date: "2026-11-03", note: "Deposit" });

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-03T12:00:00Z"));
  vi.stubGlobal("window", { localStorage: storage(), sessionStorage: storage(), dispatchEvent: vi.fn() });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("recording and removing payments", () => {
  it("moves sent → partially paid → paid, and reverses after removal", () => {
    saveInvoice(invoice());
    expect(addPayment("invoice-1", payment(40))?.status).toBe("partially_paid");
    expect(addPayment("invoice-1", payment(60, "payment-2"))?.status).toBe("paid");
    expect(removePayment("invoice-1", "payment-2")?.status).toBe("partially_paid");
    expect(removePayment("invoice-1", "payment-1")?.status).toBe("sent");
  });
  it("restores overdue status after removing the last payment", () => {
    saveInvoice(invoice({ dateDue: "2026-10-01" }));
    expect(addPayment("invoice-1", payment(100))?.status).toBe("paid");
    expect(removePayment("invoice-1", "payment-1")?.status).toBe("overdue");
  });
  it("rejects non-finite, non-positive, sub-cent and excessive payments", () => {
    saveInvoice(invoice());
    for (const amount of [NaN, Infinity, -1, 0, 0.001, 100.01]) {
      expect(addPayment("invoice-1", payment(amount))).toBeNull();
    }
    expect(getInvoice("invoice-1")?.payments).toHaveLength(0);
  });
  it("records a repeated payment ID once, including a settled invoice", () => {
    saveInvoice(invoice());
    addPayment("invoice-1", payment(100));
    expect(addPayment("invoice-1", payment(100))?.payments).toHaveLength(1);
    expect(addPayment("invoice-1", payment(20))).toBeNull();
  });
  it("supports payments on drafts and credits settling the remaining balance", () => {
    saveInvoice(invoice({ status: "draft", adjustments: [{ id: "credit", label: "Offset", amount: 20 }] }));
    expect(getInvoice("invoice-1")?.status).toBe("draft");
    expect(addPayment("invoice-1", payment(80))?.status).toBe("paid");
  });
});

describe("workspace flow", () => {
  it("keeps guest invoices in session storage and account invoices separate", () => {
    saveInvoice(invoice({ id: "account-invoice" }));
    setGuestModeEnabled(true);
    expect(getInvoices()).toEqual([]);
    saveInvoice(invoice({ id: "guest-invoice" }));
    expect(getInvoices().map(i => i.id)).toEqual(["guest-invoice"]);
    setGuestModeEnabled(false);
    expect(getInvoices().map(i => i.id)).toEqual(["account-invoice"]);
  });
  it("duplicates into an independent draft without payment, credit, share or delivery history", () => {
    const original = invoice({ status: "paid", payments: [payment(80)], adjustments: [{ id: "credit", label: "Offset", amount: 20 }], publicEnabled: true, publicToken: "old-token", sentAt: "2026-11-01", emailDelivery: { status: "sent" } });
    saveInvoice(original);
    const copy = duplicateInvoice(original);
    expect(copy.id).not.toBe(original.id);
    expect(copy).toMatchObject({ status: "draft", payments: [], adjustments: [], publicEnabled: false, emailDelivery: { status: "idle" }, reminderHistory: [], dateIssued: "2026-11-03", dateDue: "2026-12-03" });
    expect(copy.publicToken).not.toBe(original.publicToken);
    expect(copy.sentAt).toBeUndefined();
    copy.lineItems[0].description = "Changed";
    expect(original.lineItems[0].description).toBe("Design");
    expect(getInvoice(copy.id)?.status).toBe("draft");
  });
  it("exports and imports invoice payment and credit records without losing balance", () => {
    saveInvoice(invoice({ adjustments: [{ id: "credit", label: "Offset", amount: 10 }], payments: [payment(20)] }));
    const snapshot = exportWorkspaceData();
    window.localStorage.clear();
    importWorkspaceData(snapshot);
    expect(getInvoice("invoice-1")).toMatchObject({ status: "partially_paid", payments: [payment(20)], adjustments: [{ id: "credit", label: "Offset", amount: 10 }] });
  });
  it("marks unpaid sent invoices overdue after the due date, never drafts", () => {
    saveInvoice(invoice({ dateDue: "2026-11-03" }));
    saveInvoice(invoice({ id: "draft", status: "draft", dateDue: "2026-11-01" }));
    expect(getInvoice("invoice-1")?.status).toBe("sent");
    vi.setSystemTime(new Date("2026-11-04T12:00:00Z"));
    markOverdueInvoices();
    expect(getInvoice("invoice-1")?.status).toBe("overdue");
    expect(getInvoice("draft")?.status).toBe("draft");
  });
});
