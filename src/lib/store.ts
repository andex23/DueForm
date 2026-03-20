import {
  Invoice,
  BusinessProfile,
  ClientInfo,
  SavedService,
  PaymentInfo,
  EmailSenderSettings,
  PaymentMethod,
  PartialPayment,
  InvoiceStatus,
  WorkspaceSnapshot,
  CRYPTO_CURRENCIES,
  InvoiceAdjustment,
} from "./types";
import { v4 as uuidv4 } from "uuid";
import {
  calculateAdjustmentTotal,
  calculateTotal,
  getDefaultReminderRules,
} from "./helpers";
import { isGuestModeEnabled } from "./cloud";

const STORAGE_KEY = "dru-invoices";
const BUSINESSES_KEY = "dru-businesses";
const COUNTER_KEY = "dru-invoice-counter";
const CLIENTS_KEY = "dru-clients";
const SERVICES_KEY = "dru-services";
const PAYMENT_KEY = "dru-payment-info";
const EMAIL_SENDER_KEY = "dru-email-sender";
export const WORKSPACE_CHANGED_EVENT = "dru-workspace-changed";

const defaultEmailSender: EmailSenderSettings = {
  fromName: "Your Business",
  fromEmail: "",
};

function getWorkspaceStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }

  return isGuestModeEnabled() ? window.sessionStorage : window.localStorage;
}

function readWorkspaceItem(key: string): string | null {
  return getWorkspaceStorage()?.getItem(key) ?? null;
}

function writeWorkspaceItem(key: string, value: string): void {
  getWorkspaceStorage()?.setItem(key, value);
}

function removeWorkspaceItem(key: string): void {
  getWorkspaceStorage()?.removeItem(key);
}

function notifyWorkspaceChanged(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(WORKSPACE_CHANGED_EVENT));
  }
}

// ─── Migration: old PaymentInfo → new PaymentInfo ───

function inferCryptoCurrency(rawValue: unknown): string {
  if (typeof rawValue !== "string") {
    return "";
  }

  const normalized = rawValue.trim().toUpperCase();
  if (!normalized) {
    return "";
  }

  const match = CRYPTO_CURRENCIES.find((currency) => {
    const byCode = currency.code === normalized;
    const byName = currency.name.toUpperCase() === normalized;
    const byPrefix = normalized.startsWith(`${currency.code} `);
    const byTaggedCode = normalized.startsWith(`${currency.code} (`);
    const byNamePrefix = normalized.startsWith(`${currency.name.toUpperCase()} `);

    return byCode || byName || byPrefix || byTaggedCode || byNamePrefix;
  });

  return match?.code || "";
}

function migratePaymentMethod(method: PaymentMethod): PaymentMethod {
  if (method.type !== "crypto") {
    return method;
  }

  return {
    ...method,
    cryptoCurrency:
      typeof method.cryptoCurrency === "string" && method.cryptoCurrency.trim()
        ? method.cryptoCurrency.trim().toUpperCase()
        : inferCryptoCurrency(method.network),
  };
}

function migrateAdjustments(raw: unknown): InvoiceAdjustment[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.map((entry) => {
    const item = typeof entry === "object" && entry ? entry : {};
    const candidate = item as Partial<InvoiceAdjustment>;

    return {
      id: candidate.id || uuidv4(),
      label: typeof candidate.label === "string" ? candidate.label : "",
      amount:
        typeof candidate.amount === "number" && Number.isFinite(candidate.amount)
          ? Math.max(0, candidate.amount)
          : 0,
    };
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function migratePaymentInfo(raw: any): PaymentInfo {
  if (!raw) return { methods: [], paymentLink: "", paymentNote: "" };
  // Already migrated
  if (Array.isArray(raw.methods)) {
    return {
      ...raw,
      methods: raw.methods.map((method: PaymentMethod) =>
        migratePaymentMethod(method)
      ),
    } as PaymentInfo;
  }
  // Old format: { bankName, accountName, accountNumber, paymentLink, paymentNote }
  const methods: PaymentMethod[] = [];
  if (raw.bankName || raw.accountName || raw.accountNumber) {
    methods.push({
      id: uuidv4(),
      type: "bank",
      label: raw.bankName || "Bank Account",
      bankName: raw.bankName || "",
      accountName: raw.accountName || "",
      accountNumber: raw.accountNumber || "",
    });
  }
  return {
    methods,
    paymentLink: raw.paymentLink || "",
    paymentNote: raw.paymentNote || "",
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function migrateInvoice(raw: any): Invoice {
  return normalizeInvoice({
    ...raw,
    adjustments: migrateAdjustments(raw.adjustments),
    paymentInfo: migratePaymentInfo(raw.paymentInfo),
    payments: raw.payments || [],
    publicToken: raw.publicToken || undefined,
    publicEnabled: raw.publicEnabled ?? false,
    emailDelivery: raw.emailDelivery || { status: "idle" },
    reminderRules: Array.isArray(raw.reminderRules)
      ? raw.reminderRules
      : getDefaultReminderRules(),
    reminderHistory: raw.reminderHistory || [],
  });
}

function calculateInvoiceTotal(invoice: Invoice): number {
  return calculateTotal(invoice.lineItems, invoice.taxRate);
}

function resolveInvoiceStatus(invoice: Invoice): InvoiceStatus {
  const totalPaid = (invoice.payments || []).reduce(
    (sum, payment) => sum + payment.amount,
    0
  );
  const adjustmentTotal = calculateAdjustmentTotal(invoice.adjustments || []);
  const invoiceTotal = calculateInvoiceTotal(invoice);
  const settledAmount = totalPaid + adjustmentTotal;
  const remainingBalance = Math.max(0, invoiceTotal - settledAmount);

  if (invoice.status !== "draft" && invoiceTotal > 0 && remainingBalance <= 0) {
    return "paid";
  }

  if (settledAmount > 0 && remainingBalance > 0) {
    return "partially_paid";
  }

  const today = new Date().toISOString().split("T")[0];
  if (
    (invoice.status === "sent" || invoice.status === "overdue") &&
    invoice.dateDue < today
  ) {
    return "overdue";
  }

  return invoice.status;
}

function normalizeInvoice(invoice: Invoice): Invoice {
  return {
    ...invoice,
    adjustments: migrateAdjustments(invoice.adjustments),
    status: resolveInvoiceStatus(invoice),
  };
}

// ─── Invoices ───

export function getInvoices(): Invoice[] {
  const data = readWorkspaceItem(STORAGE_KEY);
  if (!data) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return JSON.parse(data).map((inv: any) => migrateInvoice(inv));
}

export function getInvoice(id: string): Invoice | null {
  return getInvoices().find((inv) => inv.id === id) || null;
}

export function getInvoiceByToken(token: string): Invoice | null {
  return getInvoices().find((inv) => inv.publicToken === token) || null;
}

export function saveInvoice(invoice: Invoice): void {
  const invoices = getInvoices();
  const normalizedInvoice = normalizeInvoice(invoice);
  const index = invoices.findIndex((inv) => inv.id === invoice.id);
  if (index >= 0) {
    invoices[index] = {
      ...normalizedInvoice,
      updatedAt: new Date().toISOString(),
    };
  } else {
    invoices.unshift(normalizedInvoice);
  }
  writeWorkspaceItem(STORAGE_KEY, JSON.stringify(invoices));
  notifyWorkspaceChanged();
}

export function deleteInvoice(id: string): void {
  writeWorkspaceItem(
    STORAGE_KEY,
    JSON.stringify(getInvoices().filter((inv) => inv.id !== id))
  );
  notifyWorkspaceChanged();
}

export function getNextInvoiceNumber(): string {
  const counter = parseInt(readWorkspaceItem(COUNTER_KEY) || "0", 10) + 1;
  writeWorkspaceItem(COUNTER_KEY, counter.toString());
  return `DSL-${counter.toString().padStart(4, "0")}`;
}

// ─── Auto-overdue ───

export function markOverdueInvoices(): void {
  const invoices = getInvoices();
  let changed = false;
  const nextInvoices = invoices.map((invoice) => {
    const normalized = normalizeInvoice(invoice);

    if (normalized.status !== invoice.status) {
      changed = true;
      return {
        ...normalized,
        updatedAt: new Date().toISOString(),
      };
    }

    return invoice;
  });

  if (changed) {
    writeWorkspaceItem(STORAGE_KEY, JSON.stringify(nextInvoices));
    notifyWorkspaceChanged();
  }
}

// ─── Partial Payments ───

export function addPayment(invoiceId: string, payment: PartialPayment): Invoice | null {
  const invoices = getInvoices();
  const inv = invoices.find((i) => i.id === invoiceId);
  if (!inv) return null;
  inv.payments = [...(inv.payments || []), payment];
  inv.updatedAt = new Date().toISOString();
  inv.status = resolveInvoiceStatus(inv);
  writeWorkspaceItem(STORAGE_KEY, JSON.stringify(invoices));
  notifyWorkspaceChanged();
  return inv;
}

export function removePayment(invoiceId: string, paymentId: string): Invoice | null {
  const invoices = getInvoices();
  const inv = invoices.find((i) => i.id === invoiceId);
  if (!inv) return null;
  inv.payments = (inv.payments || []).filter((p) => p.id !== paymentId);
  inv.updatedAt = new Date().toISOString();
  inv.status = resolveInvoiceStatus(inv);
  writeWorkspaceItem(STORAGE_KEY, JSON.stringify(invoices));
  notifyWorkspaceChanged();
  return inv;
}

// ─── Business Profiles ───

const defaultBusiness: BusinessProfile = {
  id: "default",
  name: "Your Business",
  email: "",
  phone: "",
  address: "",
  website: "",
  tagline: "Creative Studio",
  isDefault: true,
};

export function getBusinessProfiles(): BusinessProfile[] {
  const data = readWorkspaceItem(BUSINESSES_KEY);
  const profiles = data ? JSON.parse(data) : [];
  return profiles.length > 0 ? profiles : [defaultBusiness];
}

export function getDefaultBusiness(): BusinessProfile {
  const profiles = getBusinessProfiles();
  return profiles.find((p: BusinessProfile) => p.isDefault) || profiles[0];
}

export function saveBusinessProfile(profile: BusinessProfile): void {
  const profiles = getBusinessProfiles();
  if (profile.isDefault) {
    profiles.forEach((p: BusinessProfile) => (p.isDefault = false));
  }
  const index = profiles.findIndex((p: BusinessProfile) => p.id === profile.id);
  if (index >= 0) {
    profiles[index] = profile;
  } else {
    profiles.unshift(profile);
  }
  writeWorkspaceItem(BUSINESSES_KEY, JSON.stringify(profiles));
  notifyWorkspaceChanged();
}

export function deleteBusinessProfile(id: string): void {
  const profiles = getBusinessProfiles().filter((p: BusinessProfile) => p.id !== id);
  if (profiles.length > 0 && !profiles.some((p: BusinessProfile) => p.isDefault)) {
    profiles[0].isDefault = true;
  }
  writeWorkspaceItem(BUSINESSES_KEY, JSON.stringify(profiles));
  notifyWorkspaceChanged();
}

// ─── Payment Info (global defaults) ───

export function getPaymentInfo(): PaymentInfo {
  const data = readWorkspaceItem(PAYMENT_KEY);
  if (!data) return { methods: [], paymentLink: "", paymentNote: "" };
  return migratePaymentInfo(JSON.parse(data));
}

export function savePaymentInfo(info: PaymentInfo): void {
  writeWorkspaceItem(PAYMENT_KEY, JSON.stringify(info));
  notifyWorkspaceChanged();
}

export function getEmailSenderSettings(): EmailSenderSettings {
  const data = readWorkspaceItem(EMAIL_SENDER_KEY);
  if (!data) return defaultEmailSender;

  try {
    return { ...defaultEmailSender, ...JSON.parse(data) };
  } catch {
    return defaultEmailSender;
  }
}

export function saveEmailSenderSettings(settings: EmailSenderSettings): void {
  writeWorkspaceItem(
    EMAIL_SENDER_KEY,
    JSON.stringify({ ...defaultEmailSender, ...settings })
  );
  notifyWorkspaceChanged();
}

export function exportWorkspaceData(): WorkspaceSnapshot {
  const counter = parseInt(readWorkspaceItem(COUNTER_KEY) || "0", 10);

  return {
    version: 1,
    counter,
    invoices: getInvoices(),
    businesses: getBusinessProfiles(),
    clients: getSavedClients(),
    services: getSavedServices(),
    paymentInfo: getPaymentInfo(),
    emailSender: getEmailSenderSettings(),
    exportedAt: new Date().toISOString(),
  };
}

export function importWorkspaceData(snapshot: WorkspaceSnapshot): void {
  const migratedInvoices = (snapshot.invoices || []).map((invoice) =>
    migrateInvoice(invoice)
  );

  writeWorkspaceItem(STORAGE_KEY, JSON.stringify(migratedInvoices));
  writeWorkspaceItem(
    BUSINESSES_KEY,
    JSON.stringify(snapshot.businesses || [])
  );
  writeWorkspaceItem(CLIENTS_KEY, JSON.stringify(snapshot.clients || []));
  writeWorkspaceItem(SERVICES_KEY, JSON.stringify(snapshot.services || []));
  writeWorkspaceItem(
    PAYMENT_KEY,
    JSON.stringify(migratePaymentInfo(snapshot.paymentInfo))
  );
  writeWorkspaceItem(
    EMAIL_SENDER_KEY,
    JSON.stringify({ ...defaultEmailSender, ...(snapshot.emailSender || {}) })
  );
  writeWorkspaceItem(
    COUNTER_KEY,
    String(typeof snapshot.counter === "number" ? snapshot.counter : 0)
  );
  notifyWorkspaceChanged();
}

export function clearWorkspaceData(): void {
  removeWorkspaceItem(STORAGE_KEY);
  removeWorkspaceItem(BUSINESSES_KEY);
  removeWorkspaceItem(CLIENTS_KEY);
  removeWorkspaceItem(SERVICES_KEY);
  removeWorkspaceItem(PAYMENT_KEY);
  removeWorkspaceItem(EMAIL_SENDER_KEY);
  removeWorkspaceItem(COUNTER_KEY);
  notifyWorkspaceChanged();
}

// ─── Saved Clients ───

export function getSavedClients(): ClientInfo[] {
  const data = readWorkspaceItem(CLIENTS_KEY);
  return data ? JSON.parse(data) : [];
}

export function saveClient(client: ClientInfo): void {
  const clients = getSavedClients();
  const index = clients.findIndex((c) => c.id === client.id);
  if (index >= 0) clients[index] = client;
  else clients.unshift(client);
  writeWorkspaceItem(CLIENTS_KEY, JSON.stringify(clients));
  notifyWorkspaceChanged();
}

export function deleteClient(id: string): void {
  writeWorkspaceItem(
    CLIENTS_KEY,
    JSON.stringify(getSavedClients().filter((c) => c.id !== id))
  );
  notifyWorkspaceChanged();
}

// ─── Saved Services ───

export function getSavedServices(): SavedService[] {
  const data = readWorkspaceItem(SERVICES_KEY);
  return data ? JSON.parse(data) : [];
}

export function saveService(service: SavedService): void {
  const services = getSavedServices();
  const index = services.findIndex((s) => s.id === service.id);
  if (index >= 0) services[index] = service;
  else services.unshift(service);
  writeWorkspaceItem(SERVICES_KEY, JSON.stringify(services));
  notifyWorkspaceChanged();
}

export function deleteService(id: string): void {
  writeWorkspaceItem(
    SERVICES_KEY,
    JSON.stringify(getSavedServices().filter((s) => s.id !== id))
  );
  notifyWorkspaceChanged();
}
