"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Globe2, Wallet } from "lucide-react";
import InvoiceDocument from "@/components/InvoiceDocument";
import { getInvoiceByToken } from "@/lib/store";
import {
  calculateAdjustmentTotal,
  calculateBalance,
  calculateTotal,
  formatCurrency,
  formatDate,
} from "@/lib/helpers";
import { useHydrated } from "@/lib/useHydrated";
import StatusBadge from "@/components/StatusBadge";
import { getPublicInvoiceFromCloud, isCloudConfigured } from "@/lib/cloud";
import { Invoice } from "@/lib/types";

export default function PublicInvoicePage() {
  const hydrated = useHydrated();
  const params = useParams();
  const token = params.token as string;
  const localInvoice = hydrated ? getInvoiceByToken(token) : null;
  const [cloudInvoice, setCloudInvoice] = useState<Invoice | null>(null);
  const [loadingCloud, setLoadingCloud] = useState(false);
  const invoice = localInvoice || cloudInvoice;

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    if (localInvoice) {
      return;
    }

    if (!isCloudConfigured()) {
      return;
    }

    let cancelled = false;

    async function loadInvoice() {
      setLoadingCloud(true);
      const cloudInvoice = await getPublicInvoiceFromCloud(token);
      if (!cancelled) {
        setCloudInvoice(cloudInvoice);
        setLoadingCloud(false);
      }
    }

    loadInvoice();

    return () => {
      cancelled = true;
    };
  }, [hydrated, localInvoice, token]);

  if (!hydrated || loadingCloud) {
    return (
      <div className="min-h-screen bg-bg text-text flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!invoice || !invoice.publicEnabled) {
    return (
      <div className="min-h-screen bg-bg text-text flex items-center justify-center px-6">
        <div className="max-w-[460px] w-full bg-bg-card border border-border rounded-[12px] p-8 text-center shadow-[0_10px_24px_rgba(0,0,0,0.14)]">
          <Globe2 size={28} className="text-accent mx-auto mb-3" />
          <h1 className="font-[family-name:var(--font-display)] text-[28px] font-semibold m-0">
            Invoice Unavailable
          </h1>
          <p className="text-[14px] text-text-dim leading-relaxed mt-3 mb-0">
            This invoice link is private, expired, or no longer available.
          </p>
        </div>
      </div>
    );
  }

  const total = calculateTotal(invoice.lineItems, invoice.taxRate);
  const adjustmentTotal = calculateAdjustmentTotal(invoice.adjustments || []);
  const balance = calculateBalance(
    invoice.lineItems,
    invoice.taxRate,
    invoice.payments || [],
    invoice.adjustments || []
  );

  return (
    <div className="min-h-screen bg-bg text-text px-5 py-6 md:px-8 lg:px-10">
      <div className="mx-auto max-w-[1080px] space-y-6">
        <section className="rounded-[12px] border border-border bg-[linear-gradient(180deg,rgba(18,19,22,0.96),rgba(13,14,16,0.96))] p-5 shadow-[0_10px_24px_rgba(0,0,0,0.14)]">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <Link
                href="/"
                className="inline-flex items-center gap-2 text-[12px] uppercase tracking-[0.2em] text-text-dim hover:text-accent no-underline"
              >
                <ArrowLeft size={14} />
                DueForm
              </Link>
              <div className="mt-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
                Public Invoice
              </div>
              <h1 className="mt-3 font-[family-name:var(--font-display)] text-[34px] font-semibold tracking-tight text-text">
                {invoice.invoiceNumber}
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <StatusBadge status={invoice.status} />
                <span className="text-[13px] text-text-dim">
                  {invoice.client.name} · Due {formatDate(invoice.dateDue)}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-stretch gap-3">
              <div className="min-w-[164px] rounded-[10px] border border-border bg-bg-card px-5 py-4">
                <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-text-dim">
                  Invoice Total
                </span>
                <div className="mt-2 font-[family-name:var(--font-mono)] text-[24px] font-semibold text-text">
                  {formatCurrency(total, invoice.currency)}
                </div>
              </div>
              {adjustmentTotal > 0 && (
                <div className="min-w-[164px] rounded-[10px] border border-border bg-bg-card px-5 py-4">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-text-dim">
                    Credits
                  </span>
                  <div className="mt-2 font-[family-name:var(--font-mono)] text-[24px] font-semibold text-success">
                    -{formatCurrency(adjustmentTotal, invoice.currency)}
                  </div>
                </div>
              )}
              <div className="min-w-[164px] rounded-[10px] border border-border bg-bg-card px-5 py-4">
                <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-text-dim">
                  Balance Due
                </span>
                <div className="mt-2 font-[family-name:var(--font-mono)] text-[24px] font-semibold text-accent">
                  {formatCurrency(balance, invoice.currency)}
                </div>
              </div>
              {invoice.paymentInfo.paymentLink && (
                <a
                  href={invoice.paymentInfo.paymentLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 self-center rounded-lg bg-accent px-5 py-3 text-[13px] font-semibold text-bg no-underline transition-all hover:bg-accent-hover"
                >
                  <Wallet size={16} />
                  Pay Now
                </a>
              )}
            </div>
          </div>
        </section>

        <InvoiceDocument invoice={invoice} />
      </div>
    </div>
  );
}
