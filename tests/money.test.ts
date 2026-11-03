import { describe, expect, it } from "vitest";
import {
  calculateSubtotal, calculateTax, calculateTotal, calculateAdjustedTotal,
  calculateAmountPaid, calculateBalance, calculateReminderDate,
  getDueReminderRules, getNextReminderRule, generatePublicToken, summarizeInvoiceMoney,
} from "../src/lib/helpers";
import { invoice } from "./fixtures";

const payment = (amount: number) => ({ id: String(amount), amount, date: "2026-11-01", note: "" });

describe("invoice totals", () => {
  it("rounds line items, tax and totals to displayed cents", () => {
    const items = [{ id: "1", description: "Fractional", quantity: 3, rate: 0.1 }, { id: "2", description: "Time", quantity: 1.25, rate: 9.99 }];
    expect(calculateSubtotal(items)).toBe(12.79);
    expect(calculateTax(12.79, 7.5)).toBe(0.96);
    expect(calculateTotal(items, 7.5)).toBe(13.75);
  });
  it("applies credits after tax and clamps the amount due at zero", () => {
    const items = invoice().lineItems;
    expect(calculateAdjustedTotal(items, 10, [{ id: "credit", label: "Deposit", amount: 20 }])).toBe(90);
    expect(calculateAdjustedTotal(items, 10, [{ id: "credit", label: "Waiver", amount: 200 }])).toBe(0);
    expect(calculateAdjustedTotal(items, 0, [{ id: "bad", label: "Invalid", amount: NaN }])).toBe(100);
  });
  it("settles decimal partial payments without fractional-cent residue", () => {
    const items = [{ id: "1", description: "Work", quantity: 3, rate: 0.1 }];
    expect(calculateAmountPaid([payment(0.1), payment(0.2)])).toBe(0.3);
    expect(calculateBalance(items, 0, [payment(0.1), payment(0.2)])).toBe(0);
    expect(calculateBalance(items, 0, [payment(1)])).toBe(0);
  });
  it("keeps currencies separate and excludes credits from revenue", () => {
    const totals = summarizeInvoiceMoney([
      invoice({ payments: [payment(40)], adjustments: [{ id: "c", label: "Credit", amount: 10 }] }),
      invoice({ id: "ngn", currency: "NGN", payments: [payment(50)] }),
      invoice({ id: "draft", status: "draft" }),
    ]);
    expect(totals).toEqual({ USD: { revenue: 40, outstanding: 50 }, NGN: { revenue: 50, outstanding: 50 } });
  });
});

describe("reminders", () => {
  it("uses date-only UTC arithmetic across month and leap-day boundaries", () => {
    expect(calculateReminderDate("2028-03-01", -1)).toBe("2028-02-29");
    expect(calculateReminderDate("2026-12-31", 3)).toBe("2027-01-03");
  });
  it("never schedules draft, paid or fully credited invoices", () => {
    for (const inv of [invoice({ status: "draft" }), invoice({ status: "paid" }), invoice({ adjustments: [{ id: "c", label: "Credit", amount: 100 }] })]) {
      expect(getDueReminderRules(inv, "2026-12-10")).toEqual([]);
      expect(getNextReminderRule(inv, "2026-11-01")).toBeNull();
    }
  });
  it("excludes sent and disabled rules while allowing failed reminders to retry", () => {
    const inv = invoice({ reminderHistory: [
      { id: "1", ruleId: "before_due", sentAt: "2026-11-28", to: "client@example.com", subject: "Reminder", status: "sent" },
      { id: "2", ruleId: "on_due", sentAt: "2026-12-01", to: "client@example.com", subject: "Reminder", status: "failed" },
    ] });
    expect(getDueReminderRules(inv, "2026-12-01").map(r => r.id)).toEqual(["on_due"]);
    expect(getNextReminderRule(inv, "2026-12-01")?.id).toBe("after_due");
    inv.reminderRules![2].enabled = false;
    expect(getNextReminderRule(inv, "2026-12-01")).toBeNull();
  });
});

it("generates unique cryptographically random share tokens", () => {
  const tokens = Array.from({ length: 100 }, generatePublicToken);
  expect(new Set(tokens).size).toBe(100);
  for (const token of tokens) expect(token).toMatch(/^inv_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});
