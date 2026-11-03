import type { Invoice } from "../src/lib/types";
import { getDefaultReminderRules } from "../src/lib/helpers";

export function invoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: "invoice-1", invoiceNumber: "DSL-0001", status: "sent", businessId: "business-1",
    business: { id: "business-1", name: "Studio", email: "sender@example.com", phone: "", address: "", website: "", tagline: "", isDefault: true },
    client: { name: "Client", email: "client@example.com", phone: "", address: "", company: "" },
    lineItems: [{ id: "line-1", description: "Design", quantity: 1, rate: 100 }],
    adjustments: [], taxRate: 0, notes: "", paymentTerms: "Net 30",
    paymentInfo: { methods: [], paymentLink: "", paymentNote: "" },
    payments: [], currency: "USD", dateIssued: "2026-11-01", dateDue: "2026-12-01",
    reminderRules: getDefaultReminderRules(), reminderHistory: [],
    createdAt: "2026-11-01T00:00:00Z", updatedAt: "2026-11-01T00:00:00Z", ...overrides,
  };
}
