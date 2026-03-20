"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Plus,
  FileText,
  DollarSign,
  Clock,
  BellRing,
  Search,
  ChevronRight,
} from "lucide-react";
import Shell from "@/components/Shell";
import StatusBadge from "@/components/StatusBadge";
import { getInvoices } from "@/lib/store";
import {
  formatCurrency,
  formatDate,
  calculateBalance,
  calculateTotal,
  getDueReminderRules,
} from "@/lib/helpers";
import { useHydrated } from "@/lib/useHydrated";

export default function Dashboard() {
  const hydrated = useHydrated();

  if (!hydrated) {
    return (
      <Shell>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      </Shell>
    );
  }

  return <DashboardContent />;
}

function DashboardContent() {
  const invoices = getInvoices();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const statusOptions = [
    "all",
    "draft",
    "sent",
    "partially_paid",
    "paid",
    "overdue",
  ] as const;

  const filtered = invoices.filter((inv) => {
    const matchesSearch =
      inv.client.name.toLowerCase().includes(search.toLowerCase()) ||
      inv.invoiceNumber.toLowerCase().includes(search.toLowerCase());
    const matchesStatus =
      filterStatus === "all" || inv.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const totalRevenue = invoices
    .filter((i) => i.status === "paid")
    .reduce((sum, i) => sum + calculateTotal(i.lineItems, i.taxRate), 0);

  const totalOutstanding = invoices
    .filter(
      (i) =>
        i.status === "sent" ||
        i.status === "overdue" ||
        i.status === "partially_paid"
    )
    .reduce(
      (sum, i) =>
        sum + calculateBalance(i.lineItems, i.taxRate, i.payments || []),
      0
    );

  const totalDraft = invoices.filter((i) => i.status === "draft").length;
  const totalOverdue = invoices.filter((i) => i.status === "overdue").length;
  const remindersDue = invoices.reduce(
    (sum, invoice) => sum + getDueReminderRules(invoice).length,
    0
  );
  const summaryCards = [
    {
      label: "Revenue",
      value: formatCurrency(totalRevenue),
      note: "Paid invoices",
      icon: DollarSign,
      tone: "text-success bg-success/10",
      valueTone: "text-text",
    },
    {
      label: "Outstanding",
      value: formatCurrency(totalOutstanding),
      note: "Awaiting payment",
      icon: Clock,
      tone: "text-accent bg-accent/10",
      valueTone: "text-accent",
    },
    {
      label: "Drafts",
      value: `${totalDraft}`,
      note: "Unsent invoices",
      icon: FileText,
      tone: "text-text-dim bg-text-dim/10",
      valueTone: "text-text",
    },
    {
      label: "Reminders",
      value: `${remindersDue}`,
      note: remindersDue > 0 ? "Ready for follow-up" : "No pending reminders",
      icon: BellRing,
      tone: "text-warning bg-warning/10",
      valueTone: "text-text",
    },
  ] as const;

  return (
    <Shell>
      <div className="mx-auto max-w-[1140px] animate-fade-in space-y-6">
        <section className="rounded-[12px] border border-border bg-[linear-gradient(180deg,rgba(18,19,22,0.96),rgba(13,14,16,0.96))] p-6 shadow-[0_10px_24px_rgba(0,0,0,0.14)]">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
                Workspace Overview
              </div>
              <h1 className="mt-3 font-[family-name:var(--font-display)] text-[34px] font-semibold tracking-tight text-text">
                Dashboard
              </h1>
              <p className="mt-3 max-w-[560px] text-[14px] leading-6 text-text-muted">
                Track invoice volume, payment pressure, and follow-up work from a calmer
                billing workspace.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-[10px] border border-border bg-bg-elevated/80 px-4 py-3 text-right">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-dim">
                  Activity
                </div>
                <div className="mt-1 text-[13px] text-text-muted">
                  {invoices.length} invoice{invoices.length !== 1 ? "s" : ""}
                  {totalOverdue > 0 ? ` · ${totalOverdue} overdue` : ""}
                </div>
              </div>
              <Link
                href="/invoices/new"
                className="flex items-center gap-2 rounded-lg bg-accent px-5 py-3 text-[13px] font-semibold text-bg transition-all hover:bg-accent-hover no-underline"
              >
                <Plus size={16} />
                New Invoice
              </Link>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {summaryCards.map((card) => {
              const Icon = card.icon;

              return (
                <div
                  key={card.label}
                  className="rounded-[10px] border border-border bg-bg-card/80 p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-text-dim">
                        {card.label}
                      </div>
                      <div className={`mt-3 font-[family-name:var(--font-mono)] text-[24px] font-semibold tracking-tight ${card.valueTone}`}>
                        {card.value}
                      </div>
                    </div>
                    <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${card.tone}`}>
                      <Icon size={17} />
                    </div>
                  </div>
                  <div className="mt-3 text-[12px] text-text-muted">{card.note}</div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-[12px] border border-border bg-bg-card p-5 shadow-[0_8px_20px_rgba(0,0,0,0.12)]">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-text-dim">
                Browse Invoices
              </div>
              <p className="mt-2 text-[13px] leading-6 text-text-muted">
                Search by client or invoice number, then narrow the list by invoice status.
              </p>
            </div>

            <div className="grid gap-3 xl:min-w-[720px] xl:grid-cols-[minmax(0,1fr)_auto]">
              <div className="relative">
                <Search
                  size={16}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-dim"
                />
                <input
                  className="w-full rounded-lg border border-border bg-bg-input pl-10 pr-4 py-3 text-[14px] text-text placeholder-text-dim/50 outline-none transition-all focus:border-accent/40"
                  placeholder="Search by client or invoice number..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <div className="flex flex-wrap gap-1 rounded-[10px] border border-border bg-bg-elevated p-1">
                {statusOptions.map((status) => (
                  <button
                    key={status}
                    onClick={() => setFilterStatus(status)}
                    className={`rounded-md px-3 py-2 text-[12px] font-medium capitalize transition-all ${
                      filterStatus === status
                        ? "bg-accent/15 text-accent"
                        : "bg-transparent text-text-dim hover:text-text-muted"
                    }`}
                  >
                    {status === "partially_paid" ? "partial" : status}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {filtered.length === 0 ? (
          <section className="rounded-[12px] border border-border bg-bg-card px-6 py-16 text-center shadow-[0_8px_20px_rgba(0,0,0,0.12)]">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[10px] border border-border bg-bg-elevated">
              <FileText size={28} className="text-text-dim" />
            </div>
            <h3 className="mt-5 text-[18px] font-semibold text-text">
              {search || filterStatus !== "all" ? "No invoices found" : "No invoices yet"}
            </h3>
            <p className="mt-2 text-[13px] leading-6 text-text-dim">
              {search || filterStatus !== "all"
                ? "Try adjusting your search or status filters."
                : "Create your first invoice to start tracking billing activity."}
            </p>
            {!search && filterStatus === "all" && (
              <div className="mt-6">
                <Link
                  href="/invoices/new"
                  className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-3 text-[13px] font-semibold text-bg transition-all hover:bg-accent-hover no-underline"
                >
                  <Plus size={16} />
                  Create Invoice
                </Link>
              </div>
            )}
          </section>
        ) : (
          <section className="overflow-hidden rounded-[12px] border border-border bg-bg-card shadow-[0_8px_20px_rgba(0,0,0,0.12)]">
            <div className="flex flex-col gap-2 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-text-dim">
                  Invoice List
                </div>
                <div className="mt-1 text-[13px] text-text-muted">
                  Showing {filtered.length} of {invoices.length} invoice
                  {invoices.length !== 1 ? "s" : ""}
                </div>
              </div>
              <div className="text-[12px] text-text-dim">
                Sorted by latest activity in your current local workspace
              </div>
            </div>

            <div className="divide-y divide-border/80">
              {filtered.map((invoice, i) => {
                const total = calculateTotal(invoice.lineItems, invoice.taxRate);
                const cur = invoice.currency || "USD";
                const balance = calculateBalance(
                  invoice.lineItems,
                  invoice.taxRate,
                  invoice.payments || []
                );
                const reminderCount = getDueReminderRules(invoice).length;

                return (
                  <Link
                    key={invoice.id}
                    href={`/invoices/${invoice.id}`}
                    className="group grid gap-4 px-5 py-4 transition-all hover:bg-bg-elevated/70 no-underline animate-fade-in md:grid-cols-[48px_minmax(0,1fr)_auto_20px]"
                    style={{ animationDelay: `${i * 0.04}s`, opacity: 0 }}
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-[10px] border border-border bg-accent/8">
                      <FileText size={18} className="text-accent/70" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="truncate text-[14px] font-semibold text-text">
                          {invoice.client.name}
                        </span>
                        <StatusBadge status={invoice.status} />
                        {reminderCount > 0 && (
                          <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.15em] text-warning">
                            <BellRing size={11} />
                            {reminderCount}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-[12px] text-text-dim">
                        {invoice.invoiceNumber} · Issued {formatDate(invoice.dateIssued)}
                      </div>
                    </div>

                    <div className="text-left md:text-right">
                      <div className="font-[family-name:var(--font-mono)] text-[16px] font-semibold text-text">
                        {formatCurrency(total, cur)}
                      </div>
                      <div className="mt-1 text-[11px] text-text-dim">
                        Due {formatDate(invoice.dateDue)} · Balance {formatCurrency(balance, cur)}
                      </div>
                    </div>

                    <div className="hidden items-center justify-center md:flex">
                      <ChevronRight
                        size={16}
                        className="text-text-dim/40 transition-colors group-hover:text-text-dim"
                      />
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </Shell>
  );
}
