"use client";

import {
  useState,
  useEffect,
  useRef,
  type ChangeEvent,
  type ReactNode,
} from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { v4 as uuidv4 } from "uuid";
import {
  AlertCircle,
  Plus,
  Trash2,
  Save,
  Eye,
  ArrowLeft,
  ChevronDown,
  Download,
  ImagePlus,
  Mail,
  UserPlus,
  Package,
  Building2,
  Landmark,
  Bitcoin,
  Wallet,
} from "lucide-react";
import toast from "react-hot-toast";
import Link from "next/link";
import StatusBadge from "./StatusBadge";
import {
  Invoice,
  LineItem,
  BusinessProfile,
  ClientInfo,
  PaymentInfo,
  PaymentMethod,
  PaymentMethodType,
  InvoiceStatus,
  CurrencyCode,
  CURRENCIES,
  CRYPTO_CURRENCIES,
  getCryptoNetworkOptions,
} from "@/lib/types";
import {
  getNextInvoiceNumber,
  saveInvoice,
  getDefaultBusiness,
  getBusinessProfiles,
  getPaymentInfo,
  getSavedClients,
  saveClient,
  getSavedServices,
} from "@/lib/store";
import {
  calculateSubtotal,
  calculateTax,
  calculateTotal,
  formatCurrency,
  generatePublicToken,
  getDefaultReminderRules,
} from "@/lib/helpers";
import { useHydrated } from "@/lib/useHydrated";

interface Props {
  existingInvoice?: Invoice | null;
}

function emptyLineItem(): LineItem {
  return { id: uuidv4(), description: "", quantity: 1, rate: 0 };
}

function todayStr() { return new Date().toISOString().split("T")[0]; }
function in30Days() { const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().split("T")[0]; }

const emptyPaymentInfo: PaymentInfo = { methods: [], paymentLink: "", paymentNote: "" };

function emptyMethod(type: PaymentMethodType): PaymentMethod {
  return {
    id: uuidv4(),
    type,
    cryptoCurrency: type === "crypto" ? "" : undefined,
    label:
      type === "bank" ? "Bank Transfer" : type === "crypto" ? "Crypto" : "PayPal",
  };
}

const METHOD_ICONS: Record<PaymentMethodType, typeof Landmark> = { bank: Landmark, crypto: Bitcoin, paypal: Wallet };
const METHOD_LABELS: Record<PaymentMethodType, string> = { bank: "Bank Transfer", crypto: "Crypto", paypal: "PayPal" };
const PAYMENT_TERM_OPTIONS = [
  "Due on receipt",
  "Net 7",
  "Net 14",
  "Net 15",
  "Net 30",
  "Net 45",
  "Net 60",
  "End of month",
];
const DUE_PRESET_OPTIONS = [
  { value: "receipt", label: "Due on receipt", days: 0, term: "Due on receipt" },
  { value: "7", label: "In 7 days", days: 7, term: "Net 7" },
  { value: "14", label: "In 14 days", days: 14, term: "Net 14" },
  { value: "15", label: "In 15 days", days: 15, term: "Net 15" },
  { value: "30", label: "In 30 days", days: 30, term: "Net 30" },
  { value: "45", label: "In 45 days", days: 45, term: "Net 45" },
  { value: "60", label: "In 60 days", days: 60, term: "Net 60" },
  { value: "custom", label: "Custom date", days: null, term: "" },
] as const;
const EDITOR_DRAFT_PREFIX = "dueform-editor-draft";

type SaveMode = "draft" | "preview" | "send" | "download";
type AutosaveState = "idle" | "saving" | "saved";
type FieldErrors = Partial<
  Record<
    "businessName" | "businessEmail" | "clientName" | "clientEmail" | "lineItems",
    string
  >
>;

interface EditorDraftSnapshot {
  business: BusinessProfile;
  client: ClientInfo;
  invoiceNumber: string;
  status: InvoiceStatus;
  dateIssued: string;
  dateDue: string;
  lineItems: LineItem[];
  taxRate: number;
  notes: string;
  paymentTerms: string;
  paymentInfo: PaymentInfo;
  currency: CurrencyCode;
}

function addDays(dateValue: string, days: number): string {
  const date = new Date(dateValue);
  date.setDate(date.getDate() + days);
  return date.toISOString().split("T")[0];
}

function deriveDuePreset(dateIssued: string, dateDue: string): string {
  const issued = new Date(dateIssued);
  const due = new Date(dateDue);
  const diff = Math.round((due.getTime() - issued.getTime()) / 86400000);
  const match = DUE_PRESET_OPTIONS.find(
    (option) => option.days !== null && option.days === diff
  );

  return match?.value || "custom";
}

function isValidEmail(value: string): boolean {
  return /\S+@\S+\.\S+/.test(value.trim());
}

function getPaymentTermOptions(currentValue: string): string[] {
  if (!currentValue.trim() || PAYMENT_TERM_OPTIONS.includes(currentValue)) {
    return PAYMENT_TERM_OPTIONS;
  }

  return [currentValue, ...PAYMENT_TERM_OPTIONS];
}

function FormSelect({
  value,
  onChange,
  children,
  className = "",
}: {
  value: string;
  onChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <select
        value={value}
        onChange={onChange}
        className="w-full appearance-none rounded-lg border border-border bg-[linear-gradient(180deg,#1b1a18,#12110f)] px-3.5 py-2.5 pr-10 text-[14px] text-text outline-none transition-all duration-200 focus:border-accent/50 focus:ring-1 focus:ring-accent/20 hover:border-border-hover cursor-pointer"
      >
        {children}
      </select>
      <ChevronDown
        size={15}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-dim"
      />
    </div>
  );
}

export default function InvoiceForm(props: Props) {
  const hydrated = useHydrated();

  if (!hydrated) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return <InvoiceFormContent {...props} />;
}

function InvoiceFormContent({ existingInvoice }: Props) {
  const router = useRouter();
  const isEditing = !!existingInvoice;
  const draftStorageKey = `${EDITOR_DRAFT_PREFIX}:${existingInvoice?.id || "new"}`;
  const initialDraft: EditorDraftSnapshot | null =
    typeof window !== "undefined"
      ? (() => {
          try {
            const raw = window.localStorage.getItem(draftStorageKey);
            return raw ? (JSON.parse(raw) as EditorDraftSnapshot) : null;
          } catch {
            return null;
          }
        })()
      : null;

  const [businessProfiles] = useState<BusinessProfile[]>(() => getBusinessProfiles());
  const [business, setBusiness] = useState<BusinessProfile>(
    () => initialDraft?.business || existingInvoice?.business || getDefaultBusiness()
  );
  const [showBizPicker, setShowBizPicker] = useState(false);

  const [client, setClient] = useState<ClientInfo>(
    () =>
      initialDraft?.client ||
      existingInvoice?.client || { name: "", email: "", address: "", phone: "", company: "" }
  );
  const [invoiceNumber, setInvoiceNumber] = useState(
    () => initialDraft?.invoiceNumber || existingInvoice?.invoiceNumber || getNextInvoiceNumber()
  );
  const [status, setStatus] = useState<InvoiceStatus>(
    () => initialDraft?.status || existingInvoice?.status || "draft"
  );
  const [dateIssued, setDateIssued] = useState(
    () => initialDraft?.dateIssued || existingInvoice?.dateIssued || todayStr()
  );
  const [dateDue, setDateDue] = useState(
    () => initialDraft?.dateDue || existingInvoice?.dateDue || in30Days()
  );
  const [lineItems, setLineItems] = useState<LineItem[]>(
    () => initialDraft?.lineItems || existingInvoice?.lineItems || [emptyLineItem()]
  );
  const [taxRate, setTaxRate] = useState(
    () => initialDraft?.taxRate || existingInvoice?.taxRate || 0
  );
  const [notes, setNotes] = useState(
    () => initialDraft?.notes || existingInvoice?.notes || ""
  );
  const [paymentTerms, setPaymentTerms] = useState(
    () => initialDraft?.paymentTerms || existingInvoice?.paymentTerms || "Net 30"
  );
  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo>(
    () => initialDraft?.paymentInfo || existingInvoice?.paymentInfo || getPaymentInfo() || emptyPaymentInfo
  );
  const [currency, setCurrency] = useState<CurrencyCode>(
    () => initialDraft?.currency || existingInvoice?.currency || "USD"
  );
  const [duePreset, setDuePreset] = useState(() =>
    deriveDuePreset(
      initialDraft?.dateIssued || existingInvoice?.dateIssued || todayStr(),
      initialDraft?.dateDue || existingInvoice?.dateDue || in30Days()
    )
  );

  const [showClientPicker, setShowClientPicker] = useState(false);
  const [showServicePicker, setShowServicePicker] = useState<string | null>(null);
  const [showAddMethod, setShowAddMethod] = useState(false);
  const [savedClients, setSavedClients] = useState<ClientInfo[]>(() => getSavedClients());
  const [savedServices] = useState<ReturnType<typeof getSavedServices>>(
    () => getSavedServices()
  );
  const clientRef = useRef<HTMLDivElement>(null);
  const serviceRef = useRef<HTMLDivElement>(null);
  const bizRef = useRef<HTMLDivElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const autosaveStatusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const autosaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [autosaveState, setAutosaveState] = useState<AutosaveState>(() =>
    initialDraft ? "saved" : "idle"
  );
  const [autosaveLabel, setAutosaveLabel] = useState(
    initialDraft ? "Draft restored" : "Not saved yet"
  );
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [expandedMethodId, setExpandedMethodId] = useState<string | null>(
    () => initialDraft?.paymentInfo.methods[0]?.id || existingInvoice?.paymentInfo.methods[0]?.id || null
  );

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (clientRef.current && !clientRef.current.contains(e.target as Node)) setShowClientPicker(false);
      if (serviceRef.current && !serviceRef.current.contains(e.target as Node)) setShowServicePicker(null);
      if (bizRef.current && !bizRef.current.contains(e.target as Node)) setShowBizPicker(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (autosaveStatusTimeoutRef.current) {
      clearTimeout(autosaveStatusTimeoutRef.current);
    }
    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current);
    }

    autosaveStatusTimeoutRef.current = setTimeout(() => {
      setAutosaveState("saving");
      setAutosaveLabel("Saving local draft...");
    }, 0);

    autosaveTimeoutRef.current = setTimeout(() => {
      const snapshot: EditorDraftSnapshot = {
        business,
        client,
        invoiceNumber,
        status,
        dateIssued,
        dateDue,
        lineItems,
        taxRate,
        notes,
        paymentTerms,
        paymentInfo,
        currency,
      };

      window.localStorage.setItem(draftStorageKey, JSON.stringify(snapshot));
      setAutosaveState("saved");
      setAutosaveLabel("Draft autosaved locally");
    }, 500);

    return () => {
      if (autosaveStatusTimeoutRef.current) {
        clearTimeout(autosaveStatusTimeoutRef.current);
      }
      if (autosaveTimeoutRef.current) {
        clearTimeout(autosaveTimeoutRef.current);
      }
    };
  }, [
    business,
    client,
    currency,
    dateDue,
    dateIssued,
    draftStorageKey,
    invoiceNumber,
    lineItems,
    notes,
    paymentInfo,
    paymentTerms,
    status,
    taxRate,
  ]);

  const syncDuePreset = (nextPreset: string, issuedDateValue: string) => {
    if (nextPreset === "custom") {
      return;
    }

    const selectedPreset = DUE_PRESET_OPTIONS.find(
      (option) => option.value === nextPreset
    );
    if (!selectedPreset || selectedPreset.days === null) {
      return;
    }

    setDateDue(addDays(issuedDateValue, selectedPreset.days));
    setPaymentTerms(selectedPreset.term);
  };

  const handleDateIssuedChange = (nextDate: string) => {
    setDateIssued(nextDate);
    syncDuePreset(duePreset, nextDate);
  };

  const handleDuePresetChange = (nextPreset: string) => {
    setDuePreset(nextPreset);
    syncDuePreset(nextPreset, dateIssued);
  };

  const handleDateDueChange = (nextDate: string) => {
    setDateDue(nextDate);
    const nextPreset = deriveDuePreset(dateIssued, nextDate);
    setDuePreset(nextPreset);

    const matchedPreset = DUE_PRESET_OPTIONS.find(
      (option) => option.value === nextPreset
    );
    if (matchedPreset?.term) {
      setPaymentTerms(matchedPreset.term);
    }
  };

  const clearFieldError = (field: keyof FieldErrors) => {
    setFieldErrors((current) => {
      if (!current[field]) {
        return current;
      }

      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const validateCompleteInvoice = (): boolean => {
    const nextErrors: FieldErrors = {};

    if (!business.name.trim()) {
      nextErrors.businessName = "Sender name is required";
    }
    if (!business.email.trim()) {
      nextErrors.businessEmail = "Sender email is required";
    } else if (!isValidEmail(business.email)) {
      nextErrors.businessEmail = "Use a valid sender email";
    }
    if (!client.name.trim()) {
      nextErrors.clientName = "Client name is required";
    }
    if (!client.email.trim()) {
      nextErrors.clientEmail = "Client email is required";
    } else if (!isValidEmail(client.email)) {
      nextErrors.clientEmail = "Use a valid client email";
    }
    if (!lineItems.some((item) => item.description.trim())) {
      nextErrors.lineItems = "Add at least one line item description";
    }

    setFieldErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      toast.error("Complete the required fields before continuing");
      return false;
    }

    return true;
  };

  const buildInvoicePayload = (): Invoice => {
    const now = new Date().toISOString();

    return {
      id: existingInvoice?.id || uuidv4(),
      invoiceNumber,
      status,
      businessId: business.id,
      business,
      client,
      lineItems,
      taxRate,
      notes,
      paymentTerms,
      paymentInfo,
      payments: existingInvoice?.payments || [],
      currency,
      dateIssued,
      dateDue,
      sentAt: existingInvoice?.sentAt,
      publicToken: existingInvoice?.publicToken || generatePublicToken(),
      publicEnabled: existingInvoice?.publicEnabled ?? false,
      emailDelivery: existingInvoice?.emailDelivery || { status: "idle" },
      reminderRules: existingInvoice?.reminderRules || getDefaultReminderRules(),
      reminderHistory: existingInvoice?.reminderHistory || [],
      createdAt: existingInvoice?.createdAt || now,
      updatedAt: now,
    };
  };

  const selectClient = (c: ClientInfo) => { setClient(c); setShowClientPicker(false); };
  const saveCurrentClient = () => {
    if (!client.name.trim()) { toast.error("Client name is required"); return; }
    if (!client.email.trim()) { toast.error("Client email is required"); return; }
    if (!isValidEmail(client.email)) { toast.error("Use a valid client email"); return; }
    const c = { ...client, id: client.id || uuidv4() };
    saveClient(c); setClient(c); setSavedClients(getSavedClients()); toast.success("Client saved");
  };
  const selectService = (itemId: string, svc: ReturnType<typeof getSavedServices>[0]) => {
    setLineItems((prev) => prev.map((item) => item.id === itemId ? { ...item, description: svc.name, rate: svc.defaultRate } : item));
    if (svc.defaultTax > 0) setTaxRate(svc.defaultTax);
    setShowServicePicker(null);
  };
  const updateLineItem = (id: string, field: keyof LineItem, value: string | number) => {
    clearFieldError("lineItems");
    setLineItems((prev) => prev.map((item) => item.id === id ? { ...item, [field]: value } : item));
  };
  const addLineItem = () => setLineItems((prev) => [...prev, emptyLineItem()]);
  const removeLineItem = (id: string) => { if (lineItems.length > 1) setLineItems((prev) => prev.filter((item) => item.id !== id)); };
  const handleLogoUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast.error("Upload an image file for the logo");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        setBusiness((current) => ({ ...current, logoDataUrl: result }));
      }
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  };
  const removeLogo = () => {
    setBusiness((current) => ({ ...current, logoDataUrl: undefined }));
  };

  // Payment method helpers
  const addPaymentMethod = (type: PaymentMethodType) => {
    const method = emptyMethod(type);
    setPaymentInfo((prev) => ({ ...prev, methods: [...prev.methods, method] }));
    setExpandedMethodId(method.id);
    setShowAddMethod(false);
  };
  const removePaymentMethod = (id: string) => {
    setPaymentInfo((prev) => ({
      ...prev,
      methods: prev.methods.filter((m) => m.id !== id),
    }));
    setExpandedMethodId((current) => (current === id ? null : current));
  };
  const updateMethod = (id: string, updates: Partial<PaymentMethod>) => {
    setPaymentInfo((prev) => ({
      ...prev,
      methods: prev.methods.map((m) =>
        m.id === id ? { ...m, ...updates } : m
      ),
    }));
  };

  const subtotal = calculateSubtotal(lineItems);
  const tax = calculateTax(subtotal, taxRate);
  const total = calculateTotal(lineItems, taxRate);

  const persistInvoice = (mode: SaveMode) => {
    if (mode !== "draft" && !validateCompleteInvoice()) {
      return;
    }

    const invoice: Invoice = buildInvoicePayload();
    saveInvoice(invoice);
    window.localStorage.removeItem(draftStorageKey);
    setAutosaveState("saved");
    setAutosaveLabel("Draft saved");

    if (mode === "draft") {
      toast.success(isEditing ? "Draft updated" : "Draft created");
      if (isEditing) {
        return;
      }
      router.push(`/invoices/${invoice.id}`);
      router.refresh();
      return;
    }

    const actionQuery =
      mode === "preview"
        ? ""
        : mode === "send"
          ? "?compose=1"
          : "?download=1";
    router.push(`/invoices/${invoice.id}${actionQuery}`);
    router.refresh();
  };

  const ic =
    "w-full rounded-lg border border-[#2f2b24] bg-[linear-gradient(180deg,#191612,#13110d)] px-4 py-3 text-[14px] text-text placeholder-text-dim/70 outline-none transition-all duration-200 focus:border-accent/50 focus:ring-1 focus:ring-accent/18";
  const icError =
    "border-danger/50 bg-[linear-gradient(180deg,rgba(96,35,35,0.24),rgba(32,17,17,0.24))] focus:border-danger/60 focus:ring-danger/15";
  const lc =
    "mb-2 block text-[12px] font-semibold uppercase tracking-[0.14em] text-[#b4ab98]";
  const sectionCard =
    "rounded-[12px] border border-[#27231c] bg-[linear-gradient(180deg,rgba(24,22,18,0.96),rgba(17,16,13,0.96))] p-6 shadow-[0_8px_24px_rgba(0,0,0,0.14)]";
  const sectionTitle =
    "text-[13px] font-semibold uppercase tracking-[0.18em] text-accent";
  const autosaveTone =
    autosaveState === "saving"
      ? "text-warning"
      : autosaveState === "saved"
        ? "text-success"
        : "text-text-dim";
  const buildMethodSummary = (method: PaymentMethod): string => {
    if (method.type === "bank") {
      return method.bankName || method.accountName || "Bank transfer";
    }
    if (method.type === "paypal") {
      return method.paypalEmail || method.paypalMe || "PayPal";
    }

    return [method.cryptoCurrency, method.network].filter(Boolean).join(" · ") || "Crypto";
  };

  return (
    <div className="mx-auto max-w-[1160px] animate-fade-in pb-24">
      <div className="sticky top-4 z-30 mb-8 rounded-[12px] border border-[#2b261e] bg-[linear-gradient(180deg,rgba(18,16,13,0.94),rgba(14,13,10,0.94))] px-5 py-4 shadow-[0_12px_30px_rgba(0,0,0,0.22)] backdrop-blur-xl">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-start gap-4">
            <Link
              href="/"
              className="mt-1 flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-bg-input text-text-muted transition-all hover:border-border-hover hover:text-text no-underline"
            >
              <ArrowLeft size={16} />
            </Link>
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="m-0 font-[family-name:var(--font-display)] text-[30px] font-semibold tracking-tight">
                  {isEditing ? "Edit Invoice" : "New Invoice"}
                </h1>
                <StatusBadge status={status} />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-text-dim">
                <span className="font-[family-name:var(--font-mono)] text-[#d3c8b0]">
                  {invoiceNumber}
                </span>
                <span className={`inline-flex items-center gap-1.5 ${autosaveTone}`}>
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  {autosaveLabel}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <FormSelect
              value={currency}
              onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
              className="min-w-[132px]"
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.symbol} {c.code}
                </option>
              ))}
            </FormSelect>
            <button
              onClick={() => persistInvoice("draft")}
              className="flex items-center gap-2 rounded-lg border border-border bg-bg-input px-4 py-2.5 text-[13px] font-medium text-text-muted transition-all hover:border-border-hover hover:text-text"
            >
              <Save size={15} />
              Save Draft
            </button>
            <button
              onClick={() => persistInvoice("preview")}
              className="flex items-center gap-2 rounded-lg border border-border bg-transparent px-4 py-2.5 text-[13px] font-medium text-text-muted transition-all hover:border-accent/30 hover:text-accent"
            >
              <Eye size={15} />
              Preview
            </button>
            <button
              onClick={() => persistInvoice("send")}
              className="flex items-center gap-2 rounded-lg border border-border bg-transparent px-4 py-2.5 text-[13px] font-medium text-text-muted transition-all hover:border-accent/30 hover:text-accent"
            >
              <Mail size={15} />
              Send
            </button>
            <button
              onClick={() => persistInvoice("download")}
              className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-[13px] font-semibold text-bg transition-all hover:bg-accent-hover"
            >
              <Download size={15} />
              Download PDF
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <section className={sectionCard}>
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <div className={sectionTitle}>Sender Details</div>
                  <p className="mt-2 text-[14px] leading-6 text-text-muted">
                    Name and email are required. Phone, address, website, and logo stay optional.
                  </p>
                </div>
                {businessProfiles.length > 1 && (
                  <div className="relative" ref={bizRef}>
                    <button
                      onClick={() => setShowBizPicker(!showBizPicker)}
                      className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-[12px] font-medium text-text-muted transition-all hover:border-accent/30 hover:text-accent"
                    >
                      <Building2 size={12} />
                      Switch
                      <ChevronDown size={12} />
                    </button>
                    {showBizPicker && (
                      <div className="absolute right-0 top-full z-30 mt-2 w-[260px] overflow-hidden rounded-lg border border-[#2f2b24] bg-bg-elevated shadow-lg shadow-black/20">
                        {businessProfiles.map((bp) => (
                          <button
                            key={bp.id}
                            onClick={() => {
                              setBusiness(bp);
                              setShowBizPicker(false);
                            }}
                            className={`w-full border-b border-border/50 px-4 py-3 text-left last:border-b-0 ${
                              bp.id === business.id ? "bg-accent/8" : "hover:bg-white/[0.03]"
                            }`}
                          >
                            <div className="text-[13px] font-semibold text-text">{bp.name}</div>
                            {bp.email && (
                              <div className="mt-1 text-[11px] text-text-dim">{bp.email}</div>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="mb-5 rounded-[10px] border border-[#2d281f] bg-[#14120f] p-4">
                <div className="flex items-start gap-4">
                  <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-[10px] border border-dashed border-[#3a3328] bg-[#11100d]">
                    {business.logoDataUrl ? (
                      <Image
                        src={business.logoDataUrl}
                        alt={`${business.name || "Business"} logo`}
                        width={96}
                        height={96}
                        unoptimized
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <ImagePlus size={20} className="text-text-dim" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#b8ae98]">
                      Logo
                    </div>
                    <p className="mt-2 text-[13px] leading-6 text-text-dim">
                      Optional. It appears on the white invoice preview and exported PDF.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        onClick={() => logoInputRef.current?.click()}
                        className="rounded-lg border border-border bg-bg-input px-3.5 py-2 text-[12px] font-medium text-text-muted transition-all hover:border-border-hover hover:text-text"
                      >
                        {business.logoDataUrl ? "Replace Logo" : "Upload Logo"}
                      </button>
                      {business.logoDataUrl && (
                        <button
                          onClick={removeLogo}
                          className="rounded-lg border border-border px-3.5 py-2 text-[12px] font-medium text-text-dim transition-all hover:border-danger/30 hover:text-danger"
                        >
                          Remove
                        </button>
                      )}
                      <input
                        ref={logoInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleLogoUpload}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-4">
                <div>
                  <label className={lc}>Business Name *</label>
                  <input
                    className={`${ic} ${fieldErrors.businessName ? icError : ""}`}
                    value={business.name}
                    onChange={(e) => {
                      clearFieldError("businessName");
                      setBusiness({ ...business, name: e.target.value });
                    }}
                    placeholder="Your Business"
                  />
                  {fieldErrors.businessName && (
                    <p className="mt-2 text-[12px] text-danger">{fieldErrors.businessName}</p>
                  )}
                </div>
                <div>
                  <label className={lc}>Email *</label>
                  <input
                    className={`${ic} ${fieldErrors.businessEmail ? icError : ""}`}
                    type="email"
                    value={business.email}
                    onChange={(e) => {
                      clearFieldError("businessEmail");
                      setBusiness({ ...business, email: e.target.value });
                    }}
                    placeholder="billing@yourbusiness.com"
                  />
                  {fieldErrors.businessEmail && (
                    <p className="mt-2 text-[12px] text-danger">{fieldErrors.businessEmail}</p>
                  )}
                </div>
                <div>
                  <label className={lc}>Tagline (Optional)</label>
                  <input
                    className={ic}
                    value={business.tagline}
                    onChange={(e) => setBusiness({ ...business, tagline: e.target.value })}
                    placeholder="Creative studio, consulting, agency..."
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className={lc}>Phone (Optional)</label>
                    <input
                      className={ic}
                      value={business.phone}
                      onChange={(e) => setBusiness({ ...business, phone: e.target.value })}
                      placeholder="+1 (555) 000-0000"
                    />
                  </div>
                  <div>
                    <label className={lc}>Website (Optional)</label>
                    <input
                      className={ic}
                      value={business.website}
                      onChange={(e) => setBusiness({ ...business, website: e.target.value })}
                      placeholder="yourbusiness.com"
                    />
                  </div>
                </div>
                <div>
                  <label className={lc}>Address (Optional)</label>
                  <textarea
                    className={`${ic} min-h-[96px] resize-none`}
                    rows={3}
                    value={business.address}
                    onChange={(e) => setBusiness({ ...business, address: e.target.value })}
                    placeholder="Street, city, state, ZIP"
                  />
                </div>
              </div>
            </section>

            <section className={sectionCard}>
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <div className={sectionTitle}>Client Details</div>
                  <p className="mt-2 text-[14px] leading-6 text-text-muted">
                    Save repeat clients, then drop them back into the invoice in one click.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {client.name.trim() && (
                    <button
                      onClick={saveCurrentClient}
                      className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-[12px] font-medium text-text-muted transition-all hover:border-accent/30 hover:text-accent"
                    >
                      <UserPlus size={12} />
                      Save
                    </button>
                  )}
                  <div className="relative" ref={clientRef}>
                    <button
                      onClick={() => setShowClientPicker(!showClientPicker)}
                      className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-[12px] font-medium text-text-muted transition-all hover:border-accent/30 hover:text-accent"
                    >
                      Saved
                      <ChevronDown size={12} />
                    </button>
                    {showClientPicker && (
                      <div className="absolute right-0 top-full z-30 mt-2 w-[280px] overflow-hidden rounded-lg border border-[#2f2b24] bg-bg-elevated shadow-lg shadow-black/20">
                        {savedClients.length === 0 ? (
                          <div className="px-4 py-4 text-[12px] text-text-dim">
                            No saved clients yet
                          </div>
                        ) : (
                          savedClients.map((savedClient) => (
                            <button
                              key={savedClient.id}
                              onClick={() => selectClient(savedClient)}
                              className="w-full border-b border-border/50 px-4 py-3 text-left last:border-b-0 hover:bg-white/[0.03]"
                            >
                              <div className="text-[13px] font-semibold text-text">
                                {savedClient.name}
                              </div>
                              <div className="mt-1 text-[11px] text-text-dim">
                                {[savedClient.company, savedClient.email]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid gap-4">
                <div>
                  <label className={lc}>Client Name *</label>
                  <input
                    className={`${ic} ${fieldErrors.clientName ? icError : ""}`}
                    value={client.name}
                    onChange={(e) => {
                      clearFieldError("clientName");
                      setClient({ ...client, name: e.target.value });
                    }}
                    placeholder="Client name"
                  />
                  {fieldErrors.clientName && (
                    <p className="mt-2 text-[12px] text-danger">{fieldErrors.clientName}</p>
                  )}
                </div>
                <div>
                  <label className={lc}>Email *</label>
                  <input
                    className={`${ic} ${fieldErrors.clientEmail ? icError : ""}`}
                    type="email"
                    value={client.email}
                    onChange={(e) => {
                      clearFieldError("clientEmail");
                      setClient({ ...client, email: e.target.value });
                    }}
                    placeholder="client@example.com"
                  />
                  {fieldErrors.clientEmail && (
                    <p className="mt-2 text-[12px] text-danger">{fieldErrors.clientEmail}</p>
                  )}
                </div>
                <div>
                  <label className={lc}>Company (Optional)</label>
                  <input
                    className={ic}
                    value={client.company}
                    onChange={(e) => setClient({ ...client, company: e.target.value })}
                    placeholder="Company name"
                  />
                </div>
                <div>
                  <label className={lc}>Phone (Optional)</label>
                  <input
                    className={ic}
                    value={client.phone}
                    onChange={(e) => setClient({ ...client, phone: e.target.value })}
                    placeholder="+1 (555) 000-0000"
                  />
                </div>
                <div>
                  <label className={lc}>Billing Address (Optional)</label>
                  <textarea
                    className={`${ic} min-h-[96px] resize-none`}
                    rows={3}
                    value={client.address}
                    onChange={(e) => setClient({ ...client, address: e.target.value })}
                    placeholder="Billing address"
                  />
                </div>
              </div>
            </section>
          </div>

          <section className={sectionCard}>
            <div className="mb-5">
              <div className={sectionTitle}>Invoice Details</div>
              <p className="mt-2 text-[14px] leading-6 text-text-muted">
                Control issued date, due date, payment terms, and invoice status in one place.
              </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <label className={lc}>Invoice Number</label>
                <input
                  className={ic}
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  placeholder="DSL-0001"
                />
              </div>
              <div>
                <label className={lc}>Date Issued</label>
                <input
                  type="date"
                  className={ic}
                  value={dateIssued}
                  onChange={(e) => handleDateIssuedChange(e.target.value)}
                />
              </div>
              <div>
                <label className={lc}>Due Date Preset</label>
                <FormSelect
                  value={duePreset}
                  onChange={(e) => handleDuePresetChange(e.target.value)}
                >
                  {DUE_PRESET_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </FormSelect>
              </div>
              <div>
                <label className={lc}>Due Date</label>
                <input
                  type="date"
                  className={ic}
                  value={dateDue}
                  onChange={(e) => handleDateDueChange(e.target.value)}
                />
              </div>
              <div>
                <label className={lc}>Payment Terms</label>
                <FormSelect
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                >
                  {getPaymentTermOptions(paymentTerms).map((term) => (
                    <option key={term} value={term}>
                      {term}
                    </option>
                  ))}
                </FormSelect>
              </div>
            </div>

            <div className="mt-5">
              <label className={lc}>Status</label>
              <div className="flex flex-wrap gap-2">
                {(
                  ["draft", "sent", "partially_paid", "paid", "overdue"] as InvoiceStatus[]
                ).map((nextStatus) => (
                  <button
                    key={nextStatus}
                    onClick={() => setStatus(nextStatus)}
                    className={`rounded-md border px-3.5 py-1.5 text-[12px] font-semibold uppercase tracking-[0.16em] transition-all ${
                      status === nextStatus
                        ? "border-accent/35 bg-accent/14 text-accent"
                        : "border-border text-text-dim hover:border-border-hover hover:text-text"
                    }`}
                  >
                    {nextStatus === "partially_paid" ? "Partial" : nextStatus}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className={sectionCard}>
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <div className={sectionTitle}>Line Items</div>
                <p className="mt-2 text-[14px] leading-6 text-text-muted">
                  Build the invoice body with reusable services, cleaner spacing, and clearer totals.
                </p>
              </div>
              <button
                onClick={addLineItem}
                className="flex items-center gap-2 rounded-lg border border-border bg-bg-input px-4 py-2.5 text-[13px] font-medium text-text-muted transition-all hover:border-accent/30 hover:text-accent"
              >
                <Plus size={14} />
                Add Item
              </button>
            </div>

            {fieldErrors.lineItems && (
              <div className="mb-4 flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/8 px-4 py-3 text-[13px] text-danger">
                <AlertCircle size={15} />
                {fieldErrors.lineItems}
              </div>
            )}

            <div className="overflow-hidden rounded-[10px] border border-[#27231c] bg-[#13110e]">
              <div className="grid grid-cols-[minmax(0,1fr)_90px_140px_140px_48px] gap-3 border-b border-border/70 px-5 py-3">
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#b5ab96]">
                  Description
                </span>
                <span className="text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-[#b5ab96]">
                  Qty
                </span>
                <span className="text-right text-[11px] font-semibold uppercase tracking-[0.16em] text-[#b5ab96]">
                  Rate
                </span>
                <span className="text-right text-[11px] font-semibold uppercase tracking-[0.16em] text-[#b5ab96]">
                  Amount
                </span>
                <span />
              </div>

              {lineItems.map((item, index) => (
                <div
                  key={item.id}
                  className="grid grid-cols-[minmax(0,1fr)_90px_140px_140px_48px] gap-3 border-b border-border/50 px-5 py-4 last:border-b-0 hover:bg-white/[0.02]"
                >
                  <div className="relative" ref={showServicePicker === item.id ? serviceRef : undefined}>
                    <div className="flex items-center gap-2">
                      <input
                        className="w-full bg-transparent text-[14px] text-text outline-none placeholder:text-text-dim/50"
                        value={item.description}
                        onChange={(e) => updateLineItem(item.id, "description", e.target.value)}
                        placeholder={`Item ${index + 1}`}
                      />
                      {savedServices.length > 0 && (
                        <button
                          onClick={() =>
                            setShowServicePicker(showServicePicker === item.id ? null : item.id)
                          }
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border text-text-dim transition-all hover:border-accent/30 hover:text-accent"
                          title="Pick saved service"
                        >
                          <Package size={13} />
                        </button>
                      )}
                    </div>
                    {showServicePicker === item.id && (
                      <div className="absolute left-0 top-full z-30 mt-2 w-[280px] overflow-hidden rounded-lg border border-[#2f2b24] bg-bg-elevated shadow-lg shadow-black/20">
                        {savedServices.map((service) => (
                          <button
                            key={service.id}
                            onClick={() => selectService(item.id, service)}
                            className="w-full border-b border-border/50 px-4 py-3 text-left last:border-b-0 hover:bg-white/[0.03]"
                          >
                            <div className="text-[13px] font-semibold text-text">
                              {service.name}
                            </div>
                            <div className="mt-1 text-[11px] text-text-dim">
                              {formatCurrency(service.defaultRate, currency)}
                              {service.description ? ` · ${service.description}` : ""}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <input
                    type="number"
                    min="1"
                    className="rounded-md border border-transparent bg-[#181612] px-3 py-2.5 text-center text-[14px] text-text outline-none transition-all focus:border-accent/35"
                    value={item.quantity}
                    onChange={(e) =>
                      updateLineItem(item.id, "quantity", parseInt(e.target.value) || 0)
                    }
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="rounded-md border border-transparent bg-[#181612] px-3 py-2.5 text-right text-[14px] text-text outline-none transition-all focus:border-accent/35"
                    value={item.rate || ""}
                    onChange={(e) =>
                      updateLineItem(item.id, "rate", parseFloat(e.target.value) || 0)
                    }
                    placeholder="0.00"
                  />
                  <div className="flex items-center justify-end text-[15px] font-semibold text-[#ece3cf] font-[family-name:var(--font-mono)]">
                    {formatCurrency(item.quantity * item.rate, currency)}
                  </div>
                  <button
                    onClick={() => removeLineItem(item.id)}
                    disabled={lineItems.length === 1}
                    className="flex h-10 w-10 items-center justify-center rounded-md border border-transparent text-text-dim transition-all hover:border-danger/20 hover:bg-danger/8 hover:text-danger disabled:cursor-not-allowed disabled:text-text-dim/30"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section className={sectionCard}>
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <div className={sectionTitle}>Payment Methods</div>
                <p className="mt-2 text-[14px] leading-6 text-text-muted">
                  Keep the common options visible first. Crypto stays available as an advanced method.
                </p>
              </div>
              <div className="relative">
                <button
                  onClick={() => setShowAddMethod(!showAddMethod)}
                  className="flex items-center gap-2 rounded-lg border border-border bg-bg-input px-4 py-2.5 text-[13px] font-medium text-text-muted transition-all hover:border-accent/30 hover:text-accent"
                >
                  <Plus size={14} />
                  Add Method
                </button>
                {showAddMethod && (
                  <div className="absolute right-0 top-full z-30 mt-2 w-[220px] overflow-hidden rounded-lg border border-[#2f2b24] bg-bg-elevated shadow-lg shadow-black/20">
                    {(["bank", "paypal", "crypto"] as PaymentMethodType[]).map((type) => {
                      const Icon = METHOD_ICONS[type];
                      return (
                        <button
                          key={type}
                          onClick={() => addPaymentMethod(type)}
                          className="flex w-full items-center gap-3 border-b border-border/50 px-4 py-3 text-left last:border-b-0 hover:bg-white/[0.03]"
                        >
                          <Icon size={15} className="text-accent" />
                          <div>
                            <div className="text-[13px] font-semibold text-text">
                              {METHOD_LABELS[type]}
                            </div>
                            {type === "crypto" && (
                              <div className="mt-1 text-[11px] text-text-dim">
                                Advanced option
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-3">
              {paymentInfo.methods.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border px-5 py-7 text-center">
                  <Wallet size={20} className="mx-auto mb-3 text-text-dim/40" />
                  <div className="text-[14px] font-semibold text-text">No payment methods yet</div>
                  <p className="mt-2 text-[13px] text-text-dim">
                    Add a bank transfer or PayPal option first, then expand into crypto if needed.
                  </p>
                </div>
              ) : (
                paymentInfo.methods.map((method) => {
                  const Icon = METHOD_ICONS[method.type];
                  const isExpanded = expandedMethodId === method.id;

                  return (
                    <div
                      key={method.id}
                      className="overflow-hidden rounded-[10px] border border-[#27231c] bg-[#14120f]"
                    >
                      <button
                        onClick={() =>
                          setExpandedMethodId((current) =>
                            current === method.id ? null : method.id
                          )
                        }
                        className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-accent">
                            <Icon size={16} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-[14px] font-semibold text-text">
                                {method.label || METHOD_LABELS[method.type]}
                              </span>
                              {method.type === "crypto" && (
                                <span className="rounded-full border border-accent/20 bg-accent/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-accent">
                                  Advanced
                                </span>
                              )}
                            </div>
                            <div className="mt-1 text-[12px] text-text-dim">
                              {buildMethodSummary(method)}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              removePaymentMethod(method.id);
                            }}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-transparent text-text-dim transition-all hover:border-danger/20 hover:bg-danger/8 hover:text-danger"
                          >
                            <Trash2 size={13} />
                          </button>
                          <ChevronDown
                            size={16}
                            className={`text-text-dim transition-transform ${isExpanded ? "rotate-180" : ""}`}
                          />
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="border-t border-border/60 px-4 pb-4 pt-4">
                          <div className="mb-4">
                            <label className={lc}>Method Label</label>
                            <input
                              className={ic}
                              value={method.label}
                              onChange={(e) => updateMethod(method.id, { label: e.target.value })}
                              placeholder="Label"
                            />
                          </div>

                          {method.type === "bank" && (
                            <div className="grid gap-4 md:grid-cols-2">
                              <div>
                                <label className={lc}>Bank Name</label>
                                <input
                                  className={ic}
                                  value={method.bankName || ""}
                                  onChange={(e) => updateMethod(method.id, { bankName: e.target.value })}
                                  placeholder="e.g. Chase, Access Bank"
                                />
                              </div>
                              <div>
                                <label className={lc}>Account Name</label>
                                <input
                                  className={ic}
                                  value={method.accountName || ""}
                                  onChange={(e) => updateMethod(method.id, { accountName: e.target.value })}
                                  placeholder="Account holder name"
                                />
                              </div>
                              <div>
                                <label className={lc}>Account Number</label>
                                <input
                                  className={ic}
                                  value={method.accountNumber || ""}
                                  onChange={(e) => updateMethod(method.id, { accountNumber: e.target.value })}
                                  placeholder="0123456789"
                                />
                              </div>
                              <div>
                                <label className={lc}>Routing Number (Optional)</label>
                                <input
                                  className={ic}
                                  value={method.routingNumber || ""}
                                  onChange={(e) => updateMethod(method.id, { routingNumber: e.target.value })}
                                  placeholder="Optional"
                                />
                              </div>
                            </div>
                          )}

                          {method.type === "paypal" && (
                            <div className="grid gap-4 md:grid-cols-2">
                              <div>
                                <label className={lc}>PayPal Email</label>
                                <input
                                  className={ic}
                                  type="email"
                                  value={method.paypalEmail || ""}
                                  onChange={(e) => updateMethod(method.id, { paypalEmail: e.target.value })}
                                  placeholder="you@example.com"
                                />
                              </div>
                              <div>
                                <label className={lc}>PayPal.me Link</label>
                                <input
                                  className={ic}
                                  value={method.paypalMe || ""}
                                  onChange={(e) => updateMethod(method.id, { paypalMe: e.target.value })}
                                  placeholder="https://paypal.me/yourname"
                                />
                              </div>
                            </div>
                          )}

                          {method.type === "crypto" && (
                            <div className="grid gap-4 md:grid-cols-2">
                              <div>
                                <label className={lc}>Crypto Currency</label>
                                <FormSelect
                                  value={method.cryptoCurrency || ""}
                                  onChange={(e) =>
                                    updateMethod(method.id, {
                                      cryptoCurrency: e.target.value,
                                    })
                                  }
                                >
                                  <option value="">Select currency</option>
                                  {CRYPTO_CURRENCIES.map((crypto) => (
                                    <option key={crypto.code} value={crypto.code}>
                                      {crypto.code} · {crypto.name}
                                    </option>
                                  ))}
                                </FormSelect>
                              </div>
                              <div>
                                <label className={lc}>Network</label>
                                <FormSelect
                                  value={method.network || ""}
                                  onChange={(e) =>
                                    updateMethod(method.id, {
                                      network: e.target.value,
                                    })
                                  }
                                >
                                  <option value="">Select network</option>
                                  {getCryptoNetworkOptions(method.network).map((network) => (
                                    <option key={network.value} value={network.value}>
                                      {network.label}
                                    </option>
                                  ))}
                                </FormSelect>
                              </div>
                              <div className="md:col-span-2">
                                <label className={lc}>Wallet Address</label>
                                <input
                                  className={ic}
                                  value={method.walletAddress || ""}
                                  onChange={(e) => updateMethod(method.id, { walletAddress: e.target.value })}
                                  placeholder="Wallet address"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div className="mt-5 rounded-[10px] border border-[#27231c] bg-[#13110e] p-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className={lc}>Payment Link (Optional)</label>
                  <input
                    className={ic}
                    value={paymentInfo.paymentLink}
                    onChange={(e) =>
                      setPaymentInfo({ ...paymentInfo, paymentLink: e.target.value })
                    }
                    placeholder="https://paystack.com/pay/..."
                  />
                </div>
                <div>
                  <label className={lc}>Payment Note</label>
                  <input
                    className={ic}
                    value={paymentInfo.paymentNote}
                    onChange={(e) =>
                      setPaymentInfo({ ...paymentInfo, paymentNote: e.target.value })
                    }
                    placeholder="Use invoice number as reference"
                  />
                </div>
              </div>
            </div>
          </section>
        </div>

        <div className="xl:sticky xl:top-[132px] xl:self-start">
          <section className={sectionCard}>
            <div className={sectionTitle}>Totals / Summary</div>
            <p className="mt-2 text-[14px] leading-6 text-text-muted">
              Keep the commercial summary visible while you work through the form.
            </p>

            <div className="mt-5 space-y-4 rounded-[10px] border border-[#27231c] bg-[#13110e] p-5">
              <div className="flex items-center justify-between text-[13px] text-text-dim">
                <span>Issued</span>
                <span className="font-[family-name:var(--font-mono)] text-[#ddd2bc]">
                  {dateIssued}
                </span>
              </div>
              <div className="flex items-center justify-between text-[13px] text-text-dim">
                <span>Due</span>
                <span className="font-[family-name:var(--font-mono)] text-[#ddd2bc]">
                  {dateDue}
                </span>
              </div>
              <div className="flex items-center justify-between text-[13px] text-text-dim">
                <span>Payment Terms</span>
                <span className="text-right text-[#ddd2bc]">{paymentTerms}</span>
              </div>
            </div>

            <div className="mt-5 space-y-3 rounded-[10px] border border-[#27231c] bg-[#13110e] p-5">
              <div className="flex items-center justify-between text-[14px] text-text-muted">
                <span>Subtotal</span>
                <span className="font-[family-name:var(--font-mono)] text-[#e9dfcb]">
                  {formatCurrency(subtotal, currency)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <label className="text-[14px] text-text-muted">Tax</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    className="w-20 rounded-md border border-[#2f2b24] bg-[#181612] px-3 py-2.5 text-right text-[14px] text-text outline-none focus:border-accent/40"
                    value={taxRate}
                    onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                  />
                  <span className="text-[13px] text-text-dim">%</span>
                </div>
              </div>
              <div className="flex items-center justify-between text-[14px] text-text-muted">
                <span>Tax Amount</span>
                <span className="font-[family-name:var(--font-mono)] text-[#e9dfcb]">
                  {formatCurrency(tax, currency)}
                </span>
              </div>
              <div className="rounded-[10px] border border-accent/20 bg-accent/10 px-4 py-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#d5bb84]">
                  Total Due
                </div>
                <div className="mt-2 text-right font-[family-name:var(--font-display)] text-[34px] font-semibold tracking-tight text-[#f0dfb7]">
                  {formatCurrency(total, currency)}
                </div>
              </div>
            </div>

            <div className="mt-5">
              <label className={lc}>Notes</label>
              <textarea
                className={`${ic} min-h-[150px] resize-none`}
                rows={6}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any extra context, thank-you note, payment guidance, or project summary."
              />
            </div>
          </section>
        </div>
      </div>

      <div className="mt-10 flex justify-end">
        <button
          onClick={() => persistInvoice("draft")}
          className="flex items-center gap-2 rounded-lg bg-accent px-5 py-3 text-[14px] font-semibold text-bg transition-all hover:bg-accent-hover"
        >
          <Save size={16} />
          {isEditing ? "Save Draft" : "Create Draft"}
        </button>
      </div>
    </div>
  );
}
