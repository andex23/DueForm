"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { v4 as uuidv4 } from "uuid";
import {
  ArrowLeft,
  BellRing,
  ChevronDown,
  Copy,
  Download,
  Edit3,
  Globe2,
  Link2,
  Loader2,
  Mail,
  Plus,
  Send,
  Trash2,
  Wallet,
  X,
} from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import InvoiceDocument from "./InvoiceDocument";
import StatusBadge from "./StatusBadge";
import { downloadInvoiceCsv } from "@/lib/generateCSV";
import {
  addPayment,
  deleteInvoice,
  exportWorkspaceData,
  getEmailSenderSettings,
  getNextInvoiceNumber,
  removePayment,
  saveInvoice,
} from "@/lib/store";
import {
  buildPublicInvoicePath,
  buildPublicInvoiceUrl,
  calculateAdjustedTotal,
  calculateAdjustmentTotal,
  calculateAmountPaid,
  calculateBalance,
  calculateReminderDate,
  calculateTotal,
  formatCurrency,
  formatDate,
  generatePublicToken,
  getDefaultReminderRules,
  getDueReminderRules,
  getNextReminderRule,
} from "@/lib/helpers";
import { generatePDF } from "@/lib/generatePDF";
import {
  getCloudClient,
  isCloudConfigured,
  isGuestModeEnabled,
  uploadWorkspaceSnapshot,
} from "@/lib/cloud";
import {
  EmailSenderSettings,
  Invoice,
  PartialPayment,
  ReminderRule,
} from "@/lib/types";

interface Props {
  invoice: Invoice;
}

function todayString() {
  return new Date().toISOString().split("T")[0];
}

export default function InvoicePreview({ invoice: initialInvoice }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const composeRequested = searchParams.get("compose") === "1";
  const downloadRequested = searchParams.get("download") === "1";
  const [invoice, setInvoice] = useState(initialInvoice);
  const [showEmailModal, setShowEmailModal] = useState(composeRequested);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [senderSettings, setSenderSettings] = useState<EmailSenderSettings>(() => {
    const saved = getEmailSenderSettings();
    return {
      fromName: saved.fromName || initialInvoice.business.name,
      fromEmail: saved.fromEmail || initialInvoice.business.email || "",
    };
  });
  const [emailTo, setEmailTo] = useState(initialInvoice.client.email);
  const [emailSubject, setEmailSubject] = useState(
    `Invoice ${initialInvoice.invoiceNumber} from ${initialInvoice.business.name}`
  );
  const [emailMessage, setEmailMessage] = useState(
    `Hi ${initialInvoice.client.name},\n\nPlease find invoice ${initialInvoice.invoiceNumber}. The current amount due is ${formatCurrency(
      calculateBalance(
        initialInvoice.lineItems,
        initialInvoice.taxRate,
        initialInvoice.payments || [],
        initialInvoice.adjustments || []
      ),
      initialInvoice.currency
    )}.\n\nDue date: ${formatDate(initialInvoice.dateDue)}.\n\nThank you for your business!\n\nBest regards,\n${initialInvoice.business.name}`
  );
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    date: todayString(),
    note: "",
  });
  const [sending, setSending] = useState(false);
  const [sendingReminderId, setSendingReminderId] = useState<string | null>(
    null
  );
  const [downloadingFormat, setDownloadingFormat] = useState<
    "pdf" | "csv" | null
  >(null);
  const [showDownloadMenu, setShowDownloadMenu] = useState(downloadRequested);
  const invoiceRef = useRef<HTMLDivElement>(null);
  const downloadMenuRef = useRef<HTMLDivElement>(null);

  const total = calculateTotal(invoice.lineItems, invoice.taxRate);
  const adjustmentTotal = calculateAdjustmentTotal(invoice.adjustments || []);
  const adjustedTotal = calculateAdjustedTotal(
    invoice.lineItems,
    invoice.taxRate,
    invoice.adjustments || []
  );
  const amountPaid = calculateAmountPaid(invoice.payments || []);
  const balance = calculateBalance(
    invoice.lineItems,
    invoice.taxRate,
    invoice.payments || [],
    invoice.adjustments || []
  );
  const dueReminderRules = getDueReminderRules(invoice);
  const nextReminderRule = getNextReminderRule(invoice);
  const publicPath = invoice.publicToken
    ? buildPublicInvoicePath(invoice.publicToken)
    : "";
  const publicUrl = invoice.publicToken
    ? buildPublicInvoiceUrl(invoice.publicToken)
    : "";

  useEffect(() => {
    if (!showDownloadMenu) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!downloadMenuRef.current?.contains(event.target as Node)) {
        setShowDownloadMenu(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [showDownloadMenu]);

  const syncWorkspaceToCloud = async (): Promise<boolean> => {
    if (!isCloudConfigured() || isGuestModeEnabled()) {
      return false;
    }

    const client = getCloudClient();
    if (!client) {
      return false;
    }

    const {
      data: { session },
    } = await client.auth.getSession();

    if (!session?.user.id) {
      return false;
    }

    const snapshot = exportWorkspaceData();
    const { error } = await uploadWorkspaceSnapshot(session.user.id, snapshot);

    if (error) {
      console.error("Public invoice publish failed", error);
      return false;
    }

    return true;
  };

  const persistInvoice = (nextInvoice: Invoice, successMessage?: string) => {
    saveInvoice(nextInvoice);
    setInvoice(nextInvoice);
    if (successMessage) {
      toast.success(successMessage);
    }
  };

  const ensurePublicInvoice = async () => {
    if (invoice.publicEnabled && invoice.publicToken) {
      const published = await syncWorkspaceToCloud();
      return published ? invoice : null;
    }

    const nextInvoice: Invoice = {
      ...invoice,
      publicEnabled: true,
      publicToken: invoice.publicToken || generatePublicToken(),
      updatedAt: new Date().toISOString(),
    };

    persistInvoice(nextInvoice);
    const published = await syncWorkspaceToCloud();
    return published ? nextInvoice : null;
  };

  const handleDownloadPDF = async () => {
    if (!invoiceRef.current) return;

    setShowDownloadMenu(false);
    setDownloadingFormat("pdf");
    try {
      await generatePDF(invoiceRef.current, `${invoice.invoiceNumber}.pdf`);
      toast.success("PDF downloaded");
    } catch (error) {
      console.error(error);
      toast.error("Failed to generate PDF");
    } finally {
      setDownloadingFormat(null);
    }
  };

  const handleDownloadCSV = async () => {
    setShowDownloadMenu(false);
    setDownloadingFormat("csv");

    try {
      downloadInvoiceCsv(invoice);
      toast.success("CSV downloaded");
    } catch (error) {
      console.error(error);
      toast.error("Failed to export CSV");
    } finally {
      setDownloadingFormat(null);
    }
  };

  const handleDuplicate = () => {
    const now = new Date().toISOString();
    const newInvoice: Invoice = {
      ...invoice,
      id: uuidv4(),
      invoiceNumber: getNextInvoiceNumber(),
      status: "draft",
      dateIssued: todayString(),
      dateDue: (() => {
        const nextDate = new Date();
        nextDate.setDate(nextDate.getDate() + 30);
        return nextDate.toISOString().split("T")[0];
      })(),
      sentAt: undefined,
      payments: [],
      publicEnabled: false,
      publicToken: generatePublicToken(),
      emailDelivery: { status: "idle" },
      reminderRules: (invoice.reminderRules || getDefaultReminderRules()).map(
        (rule) => ({ ...rule })
      ),
      reminderHistory: [],
      createdAt: now,
      updatedAt: now,
    };
    saveInvoice(newInvoice);
    toast.success(`Duplicated as ${newInvoice.invoiceNumber}`);
    router.push(`/invoices/${newInvoice.id}`);
  };

  const handleDelete = () => {
    deleteInvoice(invoice.id);
    toast.success("Invoice deleted");
    router.push("/");
  };

  const handleSendEmail = async () => {
    if (!emailTo) {
      toast.error("Email address is required");
      return;
    }

    const shareableInvoice = await ensurePublicInvoice();
    if (!shareableInvoice) {
      toast.error("Sign in to publish a public invoice link for sharing");
      return;
    }
    setSending(true);

    try {
      const response = await fetch("/api/send-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: emailTo,
          subject: emailSubject,
          message: emailMessage,
          invoice: shareableInvoice,
          senderSettings,
        }),
      });
      const data = await response.json();

      if (!data.success) {
        const failedInvoice: Invoice = {
          ...shareableInvoice,
          emailDelivery: {
            status: "failed",
            lastSentAt: new Date().toISOString(),
            lastSentTo: emailTo,
            lastSubject: emailSubject,
            lastError: data.error || "Failed to send email",
          },
          updatedAt: new Date().toISOString(),
        };
        persistInvoice(failedInvoice);
        toast.error(data.error || "Failed to send email");
        return;
      }

      const updatedInvoice: Invoice = {
        ...shareableInvoice,
        status: shareableInvoice.status === "draft" ? "sent" : shareableInvoice.status,
        sentAt: new Date().toISOString(),
        emailDelivery: {
          status: "sent",
          lastSentAt: new Date().toISOString(),
          lastSentTo: emailTo,
          lastSubject: emailSubject,
          lastMessageId: data.emailId,
        },
        updatedAt: new Date().toISOString(),
      };
      persistInvoice(updatedInvoice);
      toast.success("Invoice sent");
      setShowEmailModal(false);
    } catch (error) {
      console.error(error);
      const failedInvoice: Invoice = {
        ...invoice,
        emailDelivery: {
          status: "failed",
          lastSentAt: new Date().toISOString(),
          lastSentTo: emailTo,
          lastSubject: emailSubject,
          lastError: "Failed to send email",
        },
        updatedAt: new Date().toISOString(),
      };
      persistInvoice(failedInvoice);
      toast.error("Failed to send. Check your email settings.");
    } finally {
      setSending(false);
    }
  };

  const handleCopyPublicLink = async () => {
    const shareableInvoice = await ensurePublicInvoice();
    if (!shareableInvoice) {
      toast.error("Sign in to publish a public invoice link for sharing");
      return;
    }
    const shareUrl = buildPublicInvoiceUrl(
      shareableInvoice.publicToken || generatePublicToken()
    );

    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Public link copied");
    } catch (error) {
      console.error(error);
      toast.error("Could not copy the public link");
    }
  };

  const handleTogglePublic = async () => {
    if (!invoice.publicEnabled && (!isCloudConfigured() || isGuestModeEnabled())) {
      toast.error("Sign in to publish a public invoice link");
      return;
    }

    const nextInvoice: Invoice = {
      ...invoice,
      publicEnabled: !invoice.publicEnabled,
      publicToken: invoice.publicToken || generatePublicToken(),
      updatedAt: new Date().toISOString(),
    };

    persistInvoice(
      nextInvoice,
      nextInvoice.publicEnabled ? "Public link enabled" : "Public link disabled"
    );

    const synced = await syncWorkspaceToCloud();
    if (nextInvoice.publicEnabled && !synced) {
      toast.error("Could not publish the public invoice link yet");
    }
  };

  const handleAddPayment = () => {
    const amount = parseFloat(paymentForm.amount);
    if (!amount || amount <= 0) {
      toast.error("Enter a valid payment amount");
      return;
    }
    if (amount > balance) {
      toast.error("Payment exceeds the remaining balance");
      return;
    }

    const payment: PartialPayment = {
      id: uuidv4(),
      amount,
      date: paymentForm.date,
      note: paymentForm.note.trim(),
    };

    const updatedInvoice = addPayment(invoice.id, payment);
    if (!updatedInvoice) {
      toast.error("Could not record payment");
      return;
    }

    setInvoice(updatedInvoice);
    setPaymentForm({ amount: "", date: todayString(), note: "" });
    setShowPaymentModal(false);
    toast.success("Payment recorded");
  };

  const handleRemovePayment = (paymentId: string) => {
    const updatedInvoice = removePayment(invoice.id, paymentId);
    if (!updatedInvoice) {
      toast.error("Could not remove payment");
      return;
    }

    setInvoice(updatedInvoice);
    toast.success("Payment removed");
  };

  const handleToggleReminderRule = (ruleId: string) => {
    const nextInvoice: Invoice = {
      ...invoice,
      reminderRules: (invoice.reminderRules || getDefaultReminderRules()).map(
        (rule) =>
          rule.id === ruleId ? { ...rule, enabled: !rule.enabled } : rule
      ),
      updatedAt: new Date().toISOString(),
    };

    persistInvoice(nextInvoice, "Reminder schedule updated");
  };

  const handleSendReminder = async (rule?: ReminderRule) => {
    if (!invoice.client.email) {
      toast.error("Client email is required");
      return;
    }

    const shareableInvoice = await ensurePublicInvoice();
    if (!shareableInvoice) {
      toast.error("Sign in to publish a public invoice link for sharing");
      return;
    }
    setSendingReminderId(rule?.id || "manual");

    try {
      const response = await fetch("/api/send-reminder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: shareableInvoice.client.email,
          invoice: shareableInvoice,
          rule,
          senderSettings,
        }),
      });
      const data = await response.json();
      const sentAt = new Date().toISOString();

      const nextInvoice: Invoice = {
        ...shareableInvoice,
        reminderHistory: [
          ...(shareableInvoice.reminderHistory || []),
          {
            id: uuidv4(),
            ruleId: rule?.id,
            sentAt,
            to: shareableInvoice.client.email,
            subject: data.subject || `Reminder: ${shareableInvoice.invoiceNumber}`,
            status: data.success ? "sent" : "failed",
            messageId: data.emailId,
            error: data.success ? undefined : data.error,
          },
        ],
        updatedAt: sentAt,
      };

      persistInvoice(nextInvoice);

      if (!data.success) {
        toast.error(data.error || "Failed to send reminder");
        return;
      }

      toast.success(rule ? `Reminder sent: ${rule.label}` : "Reminder sent");
    } catch (error) {
      console.error(error);
      toast.error("Failed to send reminder");
    } finally {
      setSendingReminderId(null);
    }
  };

  const emailDeliveryLabel =
    invoice.emailDelivery?.status === "sent"
      ? `Last sent ${formatDate(invoice.emailDelivery.lastSentAt || invoice.sentAt || todayString())}`
      : invoice.emailDelivery?.status === "failed"
        ? "Last email attempt failed"
        : "Not emailed yet";

  return (
    <div className="max-w-[980px] mx-auto animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-5 mb-8">
        <div className="flex items-start gap-4">
          <Link
            href="/"
            className="w-9 h-9 rounded-lg border border-border flex items-center justify-center text-text-muted hover:text-text hover:border-border-hover transition-all no-underline"
          >
            <ArrowLeft size={16} />
          </Link>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="font-[family-name:var(--font-display)] text-[28px] font-semibold tracking-tight m-0">
                {invoice.invoiceNumber}
              </h1>
              <StatusBadge status={invoice.status} />
            </div>
            <div className="text-text-dim text-[13px] mt-1 flex flex-wrap gap-x-3 gap-y-1">
              <span>
                {invoice.client.name} · {formatDate(invoice.dateIssued)}
              </span>
              {invoice.sentAt && <span>Sent {formatDate(invoice.sentAt)}</span>}
              <span>{emailDeliveryLabel}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleDuplicate}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border text-text-muted hover:text-accent hover:border-accent/30 text-[13px] font-medium transition-all cursor-pointer bg-transparent"
          >
            <Copy size={15} />
            Duplicate
          </button>
          <button
            onClick={handleCopyPublicLink}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border text-text-muted hover:text-accent hover:border-accent/30 text-[13px] font-medium transition-all cursor-pointer bg-transparent"
          >
            <Link2 size={15} />
            Public Link
          </button>
          <button
            onClick={() => setShowEmailModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border text-text-muted hover:text-accent hover:border-accent/30 text-[13px] font-medium transition-all cursor-pointer bg-transparent"
          >
            <Mail size={15} />
            {invoice.sentAt ? "Resend" : "Email"}
          </button>
          <div className="relative" ref={downloadMenuRef}>
            <button
              onClick={() => setShowDownloadMenu((current) => !current)}
              disabled={Boolean(downloadingFormat)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border text-text-muted hover:text-text hover:border-border-hover text-[13px] font-medium transition-all cursor-pointer bg-transparent disabled:opacity-40"
            >
              {downloadingFormat ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Download size={15} />
              )}
              Download
              <ChevronDown
                size={14}
                className={`transition-transform ${showDownloadMenu ? "rotate-180" : ""}`}
              />
            </button>

            {showDownloadMenu && (
              <div className="absolute right-0 top-full z-30 mt-2 w-[220px] overflow-hidden rounded-[10px] border border-border bg-bg-card shadow-[0_16px_36px_rgba(0,0,0,0.28)]">
                <button
                  onClick={handleDownloadPDF}
                  className="w-full border-b border-border px-4 py-3 text-left transition-all hover:bg-bg-elevated"
                >
                  <div className="text-[13px] font-semibold text-text">
                    Download PDF
                  </div>
                  <div className="mt-1 text-[11px] text-text-dim">
                    Clean invoice layout for sharing or print.
                  </div>
                </button>
                <button
                  onClick={handleDownloadCSV}
                  className="w-full px-4 py-3 text-left transition-all hover:bg-bg-elevated"
                >
                  <div className="text-[13px] font-semibold text-text">
                    Export CSV
                  </div>
                  <div className="mt-1 text-[11px] text-text-dim">
                    Line items, totals, payments, and client details.
                  </div>
                </button>
              </div>
            )}
          </div>
          <Link
            href={`/invoices/${invoice.id}/edit`}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-accent text-bg text-[13px] font-semibold hover:bg-accent-hover transition-all no-underline"
          >
            <Edit3 size={15} />
            Edit
          </Link>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="w-9 h-9 rounded-lg border border-border flex items-center justify-center text-text-dim hover:text-danger hover:border-danger/30 transition-all cursor-pointer bg-transparent"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      <div
        className={`grid gap-4 mb-6 md:grid-cols-2 ${adjustmentTotal > 0 ? "xl:grid-cols-5" : "xl:grid-cols-4"}`}
      >
        <div className="bg-bg-card border border-border rounded-xl p-5">
          <span className="text-[11px] uppercase tracking-[0.15em] text-text-dim font-semibold">
            Invoice Total
          </span>
          <p className="text-[24px] font-bold m-0 mt-3 font-[family-name:var(--font-mono)]">
            {formatCurrency(total, invoice.currency)}
          </p>
        </div>
        {adjustmentTotal > 0 && (
          <div className="bg-bg-card border border-border rounded-xl p-5">
            <span className="text-[11px] uppercase tracking-[0.15em] text-text-dim font-semibold">
              Credits
            </span>
            <p className="text-[24px] font-bold m-0 mt-3 font-[family-name:var(--font-mono)] text-success">
              -{formatCurrency(adjustmentTotal, invoice.currency)}
            </p>
            <span className="text-[11px] text-text-dim mt-1 block">
              Adjusted due {formatCurrency(adjustedTotal, invoice.currency)}
            </span>
          </div>
        )}
        <div className="bg-bg-card border border-border rounded-xl p-5">
          <span className="text-[11px] uppercase tracking-[0.15em] text-text-dim font-semibold">
            Paid
          </span>
          <p className="text-[24px] font-bold m-0 mt-3 font-[family-name:var(--font-mono)] text-success">
            {formatCurrency(amountPaid, invoice.currency)}
          </p>
        </div>
        <div className="bg-bg-card border border-border rounded-xl p-5">
          <span className="text-[11px] uppercase tracking-[0.15em] text-text-dim font-semibold">
            Balance
          </span>
          <p className="text-[24px] font-bold m-0 mt-3 font-[family-name:var(--font-mono)] text-accent">
            {formatCurrency(balance, invoice.currency)}
          </p>
        </div>
        <div className="bg-bg-card border border-border rounded-xl p-5">
          <span className="text-[11px] uppercase tracking-[0.15em] text-text-dim font-semibold">
            Reminders
          </span>
          <p className="text-[24px] font-bold m-0 mt-3 font-[family-name:var(--font-mono)]">
            {dueReminderRules.length}
          </p>
          <span className="text-[11px] text-text-dim mt-1 block">
            {nextReminderRule
              ? `Next: ${nextReminderRule.label}`
              : "No pending reminders"}
          </span>
        </div>
      </div>

      <InvoiceDocument ref={invoiceRef} invoice={invoice} />

      <div className="grid lg:grid-cols-2 gap-5 mt-6">
        <div className="bg-bg-card border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-[14px] font-semibold text-text m-0">
                Payment Tracker
              </h3>
              <p className="text-[12px] text-text-dim m-0 mt-1">
                Record cash payments after any credits or barter offsets have been applied.
              </p>
            </div>
            <button
              onClick={() => setShowPaymentModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-bg text-[12px] font-semibold hover:bg-accent-hover transition-all cursor-pointer border-0"
            >
              <Plus size={14} />
              Record Payment
            </button>
          </div>

          {invoice.payments.length === 0 ? (
            <div className="border border-dashed border-border rounded-xl p-8 text-center">
              <Wallet size={22} className="text-text-dim/30 mx-auto mb-2" />
              <p className="text-[13px] text-text-dim m-0">
                No payments recorded yet
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {invoice.payments.map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-start justify-between gap-4 border border-border rounded-xl px-4 py-3"
                >
                  <div>
                    <div className="text-[14px] font-semibold text-text">
                      {formatCurrency(payment.amount, invoice.currency)}
                    </div>
                    <div className="text-[12px] text-text-dim mt-0.5">
                      {formatDate(payment.date)}
                    </div>
                    {payment.note && (
                      <div className="text-[12px] text-text-dim mt-1">
                        {payment.note}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => handleRemovePayment(payment.id)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-text-dim/30 hover:text-danger hover:bg-danger/10 transition-all cursor-pointer bg-transparent border-0"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-bg-card border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-[14px] font-semibold text-text m-0">
                Sharing & Reminders
              </h3>
              <p className="text-[12px] text-text-dim m-0 mt-1">
                Share a public link, track delivery, and send reminder emails.
              </p>
            </div>
            <button
              onClick={handleTogglePublic}
              className={`px-3 py-1.5 rounded-full text-[11px] font-semibold uppercase tracking-wider transition-all cursor-pointer border ${
                invoice.publicEnabled
                  ? "bg-success/15 text-success border-success/20"
                  : "bg-transparent text-text-dim border-border"
              }`}
            >
              {invoice.publicEnabled ? "Public on" : "Private"}
            </button>
          </div>

          <div className="border border-border rounded-xl p-4 mb-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-[13px] font-semibold text-text">
                  <Globe2 size={15} className="text-accent" />
                  Public Invoice Link
                </div>
                <p className="text-[12px] text-text-dim m-0 mt-1 break-all">
                  {invoice.publicEnabled && publicUrl
                    ? publicUrl
                    : "Enable sharing to generate a public invoice URL."}
                </p>
              </div>
              {invoice.publicEnabled && publicPath && (
                <a
                  href={publicPath}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[12px] text-accent no-underline hover:text-accent-hover"
                >
                  Open
                </a>
              )}
            </div>
            <div className="flex flex-wrap gap-2 mt-4">
              <button
                onClick={handleCopyPublicLink}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-text-muted hover:text-accent hover:border-accent/30 text-[12px] font-medium transition-all cursor-pointer bg-transparent"
              >
                <Copy size={14} />
                Copy Link
              </button>
              {invoice.paymentInfo.paymentLink && (
                <a
                  href={invoice.paymentInfo.paymentLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-text-muted hover:text-accent hover:border-accent/30 text-[12px] font-medium transition-all no-underline"
                >
                  <Wallet size={14} />
                  Payment Link
                </a>
              )}
            </div>
          </div>

          <div className="border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 text-[13px] font-semibold text-text mb-3">
              <BellRing size={15} className="text-accent" />
              Reminder Schedule
            </div>
            <div className="space-y-3">
              {(invoice.reminderRules || getDefaultReminderRules()).map((rule) => {
                const reminderDate = calculateReminderDate(
                  invoice.dateDue,
                  rule.offsetDays
                );
                const isDue = dueReminderRules.some((entry) => entry.id === rule.id);

                return (
                  <div
                    key={rule.id}
                    className="flex items-center justify-between gap-3 border border-border rounded-xl px-3 py-3"
                  >
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={rule.enabled}
                        onChange={() => handleToggleReminderRule(rule.id)}
                        className="accent-[var(--color-accent)]"
                      />
                      <div>
                        <div className="text-[13px] font-medium text-text">
                          {rule.label}
                        </div>
                        <div className="text-[11px] text-text-dim">
                          {formatDate(reminderDate)}
                        </div>
                      </div>
                    </label>
                    <button
                      onClick={() => handleSendReminder(rule)}
                      disabled={sendingReminderId === rule.id}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] font-medium transition-all cursor-pointer border-0 ${
                        isDue
                          ? "bg-accent text-bg"
                          : "bg-bg-input text-text-muted hover:text-text"
                      } disabled:opacity-50`}
                    >
                      {sendingReminderId === rule.id ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <Send size={13} />
                      )}
                      {isDue ? "Send now" : "Send"}
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
              <div>
                <div className="text-[12px] text-text-muted">
                  Delivery status
                </div>
                <div className="text-[13px] font-medium text-text mt-1">
                  {emailDeliveryLabel}
                </div>
              </div>
              <button
                onClick={() => handleSendReminder()}
                disabled={sendingReminderId === "manual"}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-text-muted hover:text-accent hover:border-accent/30 text-[12px] font-medium transition-all cursor-pointer bg-transparent disabled:opacity-50"
              >
                {sendingReminderId === "manual" ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <BellRing size={14} />
                )}
                Manual Reminder
              </button>
            </div>
          </div>
        </div>
      </div>

      {showEmailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-bg-card border border-border rounded-xl w-[520px] p-6 animate-scale-in">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-[family-name:var(--font-display)] text-[20px] font-semibold m-0">
                {invoice.sentAt ? "Resend Invoice" : "Send Invoice"}
              </h3>
              <button
                onClick={() => setShowEmailModal(false)}
                className="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-text-dim hover:text-text hover:border-border-hover transition-all cursor-pointer bg-transparent"
              >
                <X size={16} />
              </button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-text-dim mb-1.5">
                    From Name
                  </label>
                  <input
                    className="w-full bg-bg-input border border-border rounded-lg px-3.5 py-2.5 text-[14px] text-text outline-none focus:border-accent/50"
                    value={senderSettings.fromName}
                    onChange={(event) =>
                      setSenderSettings((current) => ({
                        ...current,
                        fromName: event.target.value,
                      }))
                    }
                    placeholder="Your Business"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-text-dim mb-1.5">
                    From Email
                  </label>
                  <input
                    className="w-full bg-bg-input border border-border rounded-lg px-3.5 py-2.5 text-[14px] text-text outline-none focus:border-accent/50"
                    type="email"
                    value={senderSettings.fromEmail}
                    onChange={(event) =>
                      setSenderSettings((current) => ({
                        ...current,
                        fromEmail: event.target.value,
                      }))
                    }
                    placeholder="hello@yourdomain.com"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-text-dim mb-1.5">
                  To
                </label>
                <input
                  className="w-full bg-bg-input border border-border rounded-lg px-3.5 py-2.5 text-[14px] text-text outline-none focus:border-accent/50"
                  value={emailTo}
                  onChange={(event) => setEmailTo(event.target.value)}
                  placeholder="client@example.com"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-text-dim mb-1.5">
                  Subject
                </label>
                <input
                  className="w-full bg-bg-input border border-border rounded-lg px-3.5 py-2.5 text-[14px] text-text outline-none focus:border-accent/50"
                  value={emailSubject}
                  onChange={(event) => setEmailSubject(event.target.value)}
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-text-dim mb-1.5">
                  Message
                </label>
                <textarea
                  className="w-full bg-bg-input border border-border rounded-lg px-3.5 py-2.5 text-[14px] text-text outline-none focus:border-accent/50 resize-none"
                  rows={6}
                  value={emailMessage}
                  onChange={(event) => setEmailMessage(event.target.value)}
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowEmailModal(false)}
                className="px-4 py-2.5 rounded-lg border border-border text-text-muted text-[13px] font-medium hover:border-border-hover transition-all cursor-pointer bg-transparent"
              >
                Cancel
              </button>
              <button
                onClick={handleSendEmail}
                disabled={sending}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent text-bg text-[13px] font-semibold hover:bg-accent-hover transition-all cursor-pointer border-0 disabled:opacity-50"
              >
                {sending ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Send size={15} />
                )}
                {sending ? "Sending..." : invoice.sentAt ? "Resend" : "Send Invoice"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-bg-card border border-border rounded-xl w-[440px] p-6 animate-scale-in">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-[family-name:var(--font-display)] text-[20px] font-semibold m-0">
                Record Payment
              </h3>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-text-dim hover:text-text hover:border-border-hover transition-all cursor-pointer bg-transparent"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-text-dim mb-1.5">
                  Amount
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="w-full bg-bg-input border border-border rounded-lg px-3.5 py-2.5 text-[14px] text-text outline-none focus:border-accent/50"
                  value={paymentForm.amount}
                  onChange={(event) =>
                    setPaymentForm((current) => ({
                      ...current,
                      amount: event.target.value,
                    }))
                  }
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-text-dim mb-1.5">
                  Payment Date
                </label>
                <input
                  type="date"
                  className="w-full bg-bg-input border border-border rounded-lg px-3.5 py-2.5 text-[14px] text-text outline-none focus:border-accent/50"
                  value={paymentForm.date}
                  onChange={(event) =>
                    setPaymentForm((current) => ({
                      ...current,
                      date: event.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-text-dim mb-1.5">
                  Note
                </label>
                <textarea
                  className="w-full bg-bg-input border border-border rounded-lg px-3.5 py-2.5 text-[14px] text-text outline-none focus:border-accent/50 resize-none"
                  rows={3}
                  value={paymentForm.note}
                  onChange={(event) =>
                    setPaymentForm((current) => ({
                      ...current,
                      note: event.target.value,
                    }))
                  }
                  placeholder="Optional note or payment reference"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowPaymentModal(false)}
                className="px-4 py-2.5 rounded-lg border border-border text-text-muted text-[13px] font-medium hover:border-border-hover transition-all cursor-pointer bg-transparent"
              >
                Cancel
              </button>
              <button
                onClick={handleAddPayment}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent text-bg text-[13px] font-semibold hover:bg-accent-hover transition-all cursor-pointer border-0"
              >
                <Plus size={15} />
                Save Payment
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-bg-card border border-border rounded-xl w-[400px] p-6 animate-scale-in">
            <h3 className="font-[family-name:var(--font-display)] text-[20px] font-semibold m-0 mb-2">
              Delete Invoice?
            </h3>
            <p className="text-text-muted text-[14px] m-0 mb-6">
              This will permanently delete {invoice.invoiceNumber}. This action
              cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2.5 rounded-lg border border-border text-text-muted text-[13px] font-medium hover:border-border-hover transition-all cursor-pointer bg-transparent"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-danger text-white text-[13px] font-semibold hover:bg-danger/80 transition-all cursor-pointer border-0"
              >
                <Trash2 size={15} />
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
