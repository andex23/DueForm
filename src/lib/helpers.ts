import {
  LineItem,
  CurrencyCode,
  CURRENCIES,
  PartialPayment,
  Invoice,
  ReminderRule,
} from "./types";

const DEFAULT_REMINDER_RULES: ReminderRule[] = [
  {
    id: "before_due",
    label: "3 days before due date",
    offsetDays: -3,
    enabled: true,
  },
  {
    id: "on_due",
    label: "On due date",
    offsetDays: 0,
    enabled: true,
  },
  {
    id: "after_due",
    label: "3 days after due date",
    offsetDays: 3,
    enabled: true,
  },
];

export function calculateSubtotal(items: LineItem[]): number {
  return items.reduce((sum, item) => sum + item.quantity * item.rate, 0);
}

export function calculateTax(subtotal: number, taxRate: number): number {
  return subtotal * (taxRate / 100);
}

export function calculateTotal(items: LineItem[], taxRate: number): number {
  const subtotal = calculateSubtotal(items);
  return subtotal + calculateTax(subtotal, taxRate);
}

export function calculateAmountPaid(payments: PartialPayment[]): number {
  return (payments || []).reduce((sum, p) => sum + p.amount, 0);
}

export function calculateBalance(items: LineItem[], taxRate: number, payments: PartialPayment[]): number {
  return calculateTotal(items, taxRate) - calculateAmountPaid(payments);
}

export function getDefaultReminderRules(): ReminderRule[] {
  return DEFAULT_REMINDER_RULES.map((rule) => ({ ...rule }));
}

export function formatCurrency(amount: number, currency: CurrencyCode = "USD"): string {
  const localeMap: Record<CurrencyCode, string> = {
    USD: "en-US",
    NGN: "en-NG",
    GBP: "en-GB",
    EUR: "de-DE",
    MXN: "es-MX",
    PHP: "en-PH",
    ARS: "es-AR",
    COP: "es-CO",
  };
  return new Intl.NumberFormat(localeMap[currency], {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

export function getCurrencySymbol(code: CurrencyCode): string {
  return CURRENCIES.find((c) => c.code === code)?.symbol || "$";
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function getStatusColor(status: string): string {
  switch (status) {
    case "paid":
      return "text-success";
    case "sent":
      return "text-accent";
    case "overdue":
      return "text-overdue";
    case "partially_paid":
      return "text-warning";
    default:
      return "text-text-dim";
  }
}

export function getStatusBg(status: string): string {
  switch (status) {
    case "paid":
      return "bg-success/10 text-success border-success/20";
    case "sent":
      return "bg-accent/10 text-accent border-accent/20";
    case "overdue":
      return "bg-overdue/10 text-overdue border-overdue/20";
    case "partially_paid":
      return "bg-warning/10 text-warning border-warning/20";
    default:
      return "bg-text-dim/10 text-text-dim border-text-dim/20";
  }
}

export function generatePublicToken(): string {
  return `inv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function calculateReminderDate(
  dueDate: string,
  offsetDays: number
): string {
  const date = new Date(`${dueDate}T00:00:00`);
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().split("T")[0];
}

export function getDueReminderRules(
  invoice: Invoice,
  today = new Date().toISOString().split("T")[0]
): ReminderRule[] {
  const sentRuleIds = new Set(
    (invoice.reminderHistory || [])
      .filter((entry) => entry.status === "sent" && entry.ruleId)
      .map((entry) => entry.ruleId as string)
  );

  return (invoice.reminderRules || []).filter((rule) => {
    if (!rule.enabled || sentRuleIds.has(rule.id)) {
      return false;
    }

    return calculateReminderDate(invoice.dateDue, rule.offsetDays) <= today;
  });
}

export function getNextReminderRule(
  invoice: Invoice,
  today = new Date().toISOString().split("T")[0]
): ReminderRule | null {
  const pendingRules = (invoice.reminderRules || [])
    .filter((rule) => !getDueReminderRules(invoice, today).some((due) => due.id === rule.id))
    .filter((rule) => rule.enabled);

  if (pendingRules.length === 0) {
    return null;
  }

  return pendingRules
    .slice()
    .sort((a, b) => {
      const aDate = calculateReminderDate(invoice.dateDue, a.offsetDays);
      const bDate = calculateReminderDate(invoice.dateDue, b.offsetDays);
      return aDate.localeCompare(bDate);
    })[0];
}

export function buildPublicInvoicePath(token: string): string {
  return `/public/${token}`;
}

export function buildPublicInvoiceUrl(token: string): string {
  if (typeof window === "undefined") {
    return buildPublicInvoicePath(token);
  }

  return new URL(buildPublicInvoicePath(token), window.location.origin).toString();
}
