"use client";

import Image from "next/image";
import { forwardRef } from "react";
import { Invoice, PaymentMethod } from "@/lib/types";
import {
  calculateAdjustedTotal,
  calculateAdjustmentTotal,
  calculateAmountPaid,
  calculateBalance,
  calculateSubtotal,
  calculateTax,
  calculateTotal,
  formatCurrency,
} from "@/lib/helpers";

interface Props {
  invoice: Invoice;
}

function formatShortDate(dateStr: string): string {
  if (!dateStr) {
    return "";
  }

  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getMethodName(method: PaymentMethod): string {
  if (method.label?.trim()) {
    return method.label.trim();
  }

  if (method.type === "bank") {
    return "Bank Transfer";
  }
  if (method.type === "paypal") {
    return "PayPal";
  }

  return "Crypto";
}

function getMethodSummary(methods: PaymentMethod[]): string {
  const names = methods.map((method) => getMethodName(method));
  return Array.from(new Set(names)).join(" / ");
}

function getMethodLines(method: PaymentMethod): string[] {
  if (method.type === "bank") {
    return [
      method.bankName ? `Bank: ${method.bankName}` : "",
      method.accountName ? `Account Name: ${method.accountName}` : "",
      method.accountNumber ? `Account Number: ${method.accountNumber}` : "",
      method.routingNumber ? `Routing Number: ${method.routingNumber}` : "",
    ].filter(Boolean);
  }

  if (method.type === "paypal") {
    return [
      method.paypalEmail ? `Email: ${method.paypalEmail}` : "",
      method.paypalMe ? `PayPal.me: ${method.paypalMe}` : "",
    ].filter(Boolean);
  }

  return [
    method.cryptoCurrency ? `Currency: ${method.cryptoCurrency}` : "",
    method.network ? `Network: ${method.network}` : "",
    method.walletAddress ? `Wallet: ${method.walletAddress}` : "",
  ].filter(Boolean);
}

export default forwardRef<HTMLDivElement, Props>(function InvoiceDocument(
  { invoice },
  ref
) {
  const currency = invoice.currency || "USD";
  const subtotal = calculateSubtotal(invoice.lineItems);
  const tax = calculateTax(subtotal, invoice.taxRate);
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
  const paymentInfo = invoice.paymentInfo;
  const paymentMethods = paymentInfo?.methods || [];
  const hasPaymentInfo =
    paymentMethods.length > 0 ||
    !!paymentInfo?.paymentLink ||
    !!paymentInfo?.paymentNote ||
    !!invoice.paymentTerms;
  const methodSummary = getMethodSummary(paymentMethods);
  const amountLabel = amountPaid > 0 || adjustmentTotal > 0 ? "Balance Due" : "Total Due";
  const showSeparateDueDate =
    Boolean(invoice.dateDue) && invoice.dateDue !== invoice.dateIssued;
  const senderLines = [
    invoice.business.email,
    invoice.business.phone,
    invoice.business.address,
    invoice.business.website,
  ].filter(Boolean);
  const clientLines = [
    invoice.client.company,
    invoice.client.email,
    invoice.client.phone,
    invoice.client.address,
  ].filter(Boolean);
  const headingLabelClass =
    "font-[family-name:var(--font-body)] text-[0.8rem] font-semibold uppercase tracking-[0.28em] text-[#9c7c42]";
  const metaTextClass =
    "font-[family-name:var(--font-body)] text-[0.95rem] font-medium leading-7 text-[#504840]";
  const bodyCourierClass =
    "font-['Courier_New',monospace] text-[0.95rem] font-semibold leading-7 tracking-[0.01em] text-[#413a31]";
  const amountTextClass =
    "text-[1rem] font-semibold leading-7 text-[#3f382f]";

  return (
    <div
      ref={ref}
      className="overflow-hidden rounded-[12px] border border-[#e9dfcf] bg-[#fffdf8] text-[#1d1914] shadow-[0_14px_40px_rgba(17,12,7,0.12)]"
      style={{
        backgroundImage:
          "radial-gradient(circle at top, rgba(171, 138, 74, 0.08), transparent 32%), linear-gradient(180deg, #fffdf9 0%, #faf6ee 100%)",
      }}
    >
      <div className="px-5 py-8 sm:px-8 sm:py-10 md:px-12 md:py-12 lg:px-16 lg:py-14">
        <div className="grid gap-10 md:grid-cols-[minmax(0,1fr)_320px] md:gap-16 md:items-start">
          <div className="max-w-[460px]">
            {invoice.business.logoDataUrl && (
              <div className="mb-6">
                <Image
                  src={invoice.business.logoDataUrl}
                  alt={`${invoice.business.name || "Business"} logo`}
                  width={112}
                  height={112}
                  unoptimized
                  className="h-14 w-auto object-contain sm:h-16"
                />
              </div>
            )}

            <h1 className="font-[family-name:var(--font-display)] text-[1.95rem] font-semibold leading-none tracking-[-0.04em] text-[#15110d] sm:text-[2.25rem] md:text-[2.7rem]">
              {invoice.business.name}
            </h1>

            <div className="mt-5 h-px w-28 bg-[#b4955d]" />

            <div className={`mt-5 space-y-2 sm:text-[1rem] ${bodyCourierClass}`}>
              {senderLines.map((line) => (
                <div key={line}>{line}</div>
              ))}
            </div>
          </div>

          <div className="w-full md:justify-self-end">
            <div className="flex flex-col gap-10 md:items-end">
              <div className="md:text-right">
                <div className={headingLabelClass}>
                  Invoice
                </div>
                <div className="mt-2 font-[family-name:var(--font-display)] text-[2rem] font-semibold tracking-[0.04em] text-[#9c7c42] sm:text-[2.45rem]">
                  {invoice.invoiceNumber}
                </div>
              </div>

              <div
                className={`grid gap-x-10 gap-y-3 md:text-right ${
                  showSeparateDueDate ? "grid-cols-2" : "grid-cols-1"
                }`}
              >
                <div>
                  <div className="font-[family-name:var(--font-body)] text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-[#9c7c42]">
                    {showSeparateDueDate ? "Issued" : "Date"}
                  </div>
                  <div className={`mt-2 ${metaTextClass}`}>
                    {formatShortDate(invoice.dateIssued)}
                  </div>
                </div>
                {showSeparateDueDate && (
                  <div>
                    <div className="font-[family-name:var(--font-body)] text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-[#9c7c42]">
                      Due
                    </div>
                    <div className={`mt-2 ${metaTextClass}`}>
                      {formatShortDate(invoice.dateDue)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10 h-px bg-[#ece3d6]" />

        <section className="mt-8">
          <div className={headingLabelClass}>
            Bill To
          </div>
          <div className="mt-4 max-w-[460px]">
            <div className="font-[family-name:var(--font-display)] text-[1.45rem] font-semibold leading-tight tracking-[-0.03em] text-[#17130f] sm:text-[1.65rem]">
              {invoice.client.name}
            </div>
            <div className={`mt-3 space-y-2 sm:text-[1rem] ${bodyCourierClass}`}>
              {clientLines.map((line) => (
                <div key={line}>{line}</div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-10">
          <div className="hidden border-y border-[#e8dfd2] py-4 md:grid md:grid-cols-[minmax(0,1fr)_86px_140px_160px] md:gap-6">
            <div className={headingLabelClass}>
              Description
            </div>
            <div className={`text-center ${headingLabelClass}`}>
              Qty
            </div>
            <div className={`text-right ${headingLabelClass}`}>
              Rate
            </div>
            <div className={`text-right ${headingLabelClass}`}>
              Amount
            </div>
          </div>

          <div className="hidden md:block">
            {invoice.lineItems.map((item) => (
              <div
                key={item.id}
                className="grid grid-cols-[minmax(0,1fr)_86px_140px_160px] gap-6 border-b border-[#eee5d8] py-5"
              >
                <div className="font-['Courier_New',monospace] text-[1rem] font-semibold leading-7 text-[#241e18]">
                  {item.description}
                </div>
                <div className={`text-center ${amountTextClass}`}>
                  {item.quantity}
                </div>
                <div className={`text-right ${amountTextClass}`}>
                  {formatCurrency(item.rate, currency)}
                </div>
                <div className="text-right font-[family-name:var(--font-mono)] text-[1.02rem] font-semibold leading-7 text-[#1a1510]">
                  {formatCurrency(item.quantity * item.rate, currency)}
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-4 md:hidden">
            {invoice.lineItems.map((item) => (
              <div
                key={item.id}
                className="rounded-[8px] border border-[#eadfce] bg-white/70 px-4 py-4"
              >
                <div className="font-['Courier_New',monospace] text-[1rem] font-semibold leading-7 text-[#241e18]">
                  {item.description}
                </div>
                <div className="mt-4 grid grid-cols-3 gap-3">
                  <div>
                    <div className={headingLabelClass}>
                      Qty
                    </div>
                    <div className={`mt-1 ${amountTextClass}`}>
                      {item.quantity}
                    </div>
                  </div>
                  <div>
                    <div className={headingLabelClass}>
                      Rate
                    </div>
                    <div className={`mt-1 ${amountTextClass}`}>
                      {formatCurrency(item.rate, currency)}
                    </div>
                  </div>
                  <div>
                    <div className={`text-right ${headingLabelClass}`}>
                      Amount
                    </div>
                    <div className="mt-1 text-right font-[family-name:var(--font-mono)] text-[0.98rem] font-semibold text-[#1a1510]">
                      {formatCurrency(item.quantity * item.rate, currency)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
          <div className="min-w-0">
            {hasPaymentInfo && (
              <div>
                <div className={headingLabelClass}>
                  Payment Details
                </div>

                {methodSummary && (
                  <div className="mt-4 font-[family-name:var(--font-body)] text-[1.08rem] font-semibold leading-8 text-[#1a1510]">
                    {methodSummary}
                  </div>
                )}

                {invoice.paymentTerms && (
                  <div className="mt-4 font-[family-name:var(--font-body)] text-[0.96rem] font-medium leading-7 text-[#413a31]">
                    <span className="font-semibold text-[#2e271f]">
                      Payment Terms:
                    </span>{" "}
                    <span className="font-['Courier_New',monospace] font-semibold">
                      {invoice.paymentTerms}
                    </span>
                  </div>
                )}

                <div className="mt-5 space-y-4">
                  {paymentMethods.map((method) => {
                    const lines = getMethodLines(method);
                    if (lines.length === 0) {
                      return null;
                    }

                    return (
                      <div key={method.id}>
                        <div className="font-[family-name:var(--font-body)] text-[0.76rem] font-semibold uppercase tracking-[0.22em] text-[#857661]">
                          {getMethodName(method)}
                        </div>
                        <div className={`mt-2 space-y-1.5 ${bodyCourierClass}`}>
                          {lines.map((line) => (
                            <div key={line} className="break-words">
                              {line}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {paymentInfo.paymentLink && (
                  <div className="mt-5 break-words font-[family-name:var(--font-body)] text-[0.96rem] font-medium leading-7 text-[#413a31]">
                    <span className="font-semibold text-[#2e271f]">Pay Online:</span>{" "}
                    <span className="font-['Courier_New',monospace] font-semibold text-[#9c7c42]">
                      {paymentInfo.paymentLink}
                    </span>
                  </div>
                )}

                {paymentInfo.paymentNote && (
                  <div className={`mt-3 text-[#5d554a] ${bodyCourierClass}`}>
                    {paymentInfo.paymentNote}
                  </div>
                )}
              </div>
            )}

            {invoice.notes && (
              <div className={hasPaymentInfo ? "mt-8" : ""}>
                <div className="mb-5 h-px w-16 bg-[#d8cab2]" />
                <div className={headingLabelClass}>
                  Notes
                </div>
                <div className={`mt-4 whitespace-pre-wrap ${bodyCourierClass}`}>
                  {invoice.notes}
                </div>
              </div>
            )}
          </div>

          <div className="w-full lg:justify-self-end">
            <div className="mb-5 h-px w-16 bg-[#cdbca2]" />
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-6 font-[family-name:var(--font-body)] text-[1rem] font-medium text-[#4f473d]">
                <span>Subtotal</span>
                <span className="font-[family-name:var(--font-mono)] font-semibold text-[#2a231c]">
                  {formatCurrency(subtotal, currency)}
                </span>
              </div>

              <div className="flex items-center justify-between gap-6 font-[family-name:var(--font-body)] text-[1rem] font-medium text-[#4f473d]">
                <span>Tax ({invoice.taxRate || 0}%)</span>
                <span className="font-[family-name:var(--font-mono)] font-semibold text-[#2a231c]">
                  {formatCurrency(tax, currency)}
                </span>
              </div>

              <div className="flex items-center justify-between gap-6 font-[family-name:var(--font-body)] text-[1rem] font-medium text-[#4f473d]">
                <span>Total</span>
                <span className="font-[family-name:var(--font-mono)] font-semibold text-[#2a231c]">
                  {formatCurrency(total, currency)}
                </span>
              </div>

              {(invoice.adjustments || [])
                .filter((adjustment) => adjustment.amount > 0 || adjustment.label.trim())
                .map((adjustment) => (
                  <div
                    key={adjustment.id}
                    className="flex items-center justify-between gap-6 font-[family-name:var(--font-body)] text-[1rem] font-medium text-[#4f473d]"
                  >
                    <span>{adjustment.label.trim() || "Credit / Offset"}</span>
                    <span className="font-[family-name:var(--font-mono)] font-semibold text-[#2a231c]">
                      -{formatCurrency(adjustment.amount || 0, currency)}
                    </span>
                  </div>
                ))}

              {adjustmentTotal > 0 && (
                <div className="flex items-center justify-between gap-6 font-[family-name:var(--font-body)] text-[1rem] font-medium text-[#4f473d]">
                  <span>Adjusted Due</span>
                  <span className="font-[family-name:var(--font-mono)] font-semibold text-[#2a231c]">
                    {formatCurrency(adjustedTotal, currency)}
                  </span>
                </div>
              )}

              {amountPaid > 0 && (
                <>
                  <div className="flex items-center justify-between gap-6 font-[family-name:var(--font-body)] text-[1rem] font-medium text-[#4f473d]">
                    <span>Paid</span>
                    <span className="font-[family-name:var(--font-mono)] font-semibold text-[#2a231c]">
                      {formatCurrency(amountPaid, currency)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-6 font-[family-name:var(--font-body)] text-[1rem] font-medium text-[#4f473d]">
                    <span>Balance</span>
                    <span className="font-[family-name:var(--font-mono)] font-semibold text-[#2a231c]">
                      {formatCurrency(balance, currency)}
                    </span>
                  </div>
                </>
              )}
            </div>

            <div className="mt-5 h-px bg-[#cdbca2]" />

            <div className="mt-5 flex items-end justify-between gap-4">
              <div className="font-[family-name:var(--font-body)] text-[1.05rem] font-semibold uppercase tracking-[0.16em] text-[#3b342b]">
                {amountLabel}
              </div>
              <div className="text-right font-[family-name:var(--font-display)] text-[2.25rem] font-semibold tracking-[-0.04em] text-[#9c7c42] sm:text-[2.6rem]">
                {formatCurrency(
                  amountPaid > 0 || adjustmentTotal > 0 ? balance : total,
                  currency
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
});
