"use client";

import type { Invoice, PaymentMethod } from "@/lib/types";
import {
  calculateAdjustedTotal,
  calculateAdjustmentTotal,
  calculateAmountPaid,
  calculateBalance,
  calculateSubtotal,
  calculateTax,
  calculateTotal,
} from "@/lib/helpers";

type CsvRow = Array<string | number>;

function escapeCell(value: string | number): string {
  const normalized = String(value ?? "");
  const escaped = normalized.replace(/"/g, '""');

  return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped;
}

function toCsv(rows: CsvRow[]): string {
  return rows.map((row) => row.map(escapeCell).join(",")).join("\n");
}

function methodDetail(method: PaymentMethod): string {
  if (method.type === "bank") {
    return [
      method.bankName ? `Bank: ${method.bankName}` : "",
      method.accountName ? `Account Name: ${method.accountName}` : "",
      method.accountNumber ? `Account Number: ${method.accountNumber}` : "",
      method.routingNumber ? `Routing Number: ${method.routingNumber}` : "",
    ]
      .filter(Boolean)
      .join(" | ");
  }

  if (method.type === "paypal") {
    return [
      method.paypalEmail ? `Email: ${method.paypalEmail}` : "",
      method.paypalMe ? `PayPal.me: ${method.paypalMe}` : "",
    ]
      .filter(Boolean)
      .join(" | ");
  }

  return [
    method.cryptoCurrency ? `Currency: ${method.cryptoCurrency}` : "",
    method.network ? `Network: ${method.network}` : "",
    method.walletAddress ? `Wallet: ${method.walletAddress}` : "",
  ]
    .filter(Boolean)
    .join(" | ");
}

export function buildInvoiceCsv(invoice: Invoice): string {
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

  const rows: CsvRow[] = [
    ["section", "label", "value", "quantity", "rate", "amount", "currency"],
    ["invoice", "invoice_number", invoice.invoiceNumber, "", "", "", invoice.currency],
    ["invoice", "status", invoice.status, "", "", "", invoice.currency],
    ["invoice", "issued_date", invoice.dateIssued, "", "", "", invoice.currency],
    ["invoice", "due_date", invoice.dateDue, "", "", "", invoice.currency],
    ["invoice", "payment_terms", invoice.paymentTerms || "", "", "", "", invoice.currency],
    ["business", "name", invoice.business.name, "", "", "", ""],
    ["business", "email", invoice.business.email || "", "", "", "", ""],
    ["business", "phone", invoice.business.phone || "", "", "", "", ""],
    ["business", "address", invoice.business.address || "", "", "", "", ""],
    ["business", "website", invoice.business.website || "", "", "", "", ""],
    ["client", "name", invoice.client.name, "", "", "", ""],
    ["client", "company", invoice.client.company || "", "", "", "", ""],
    ["client", "email", invoice.client.email || "", "", "", "", ""],
    ["client", "phone", invoice.client.phone || "", "", "", "", ""],
    ["client", "address", invoice.client.address || "", "", "", "", ""],
  ];

  invoice.lineItems.forEach((item) => {
    rows.push([
      "line_item",
      item.description,
      "",
      item.quantity,
      item.rate,
      item.quantity * item.rate,
      invoice.currency,
    ]);
  });

  (invoice.adjustments || [])
    .filter((adjustment) => adjustment.amount > 0 || adjustment.label.trim())
    .forEach((adjustment) => {
      rows.push([
        "credit",
        adjustment.label.trim() || "Credit / Offset",
        "",
        "",
        "",
        adjustment.amount || 0,
        invoice.currency,
      ]);
    });

  (invoice.payments || []).forEach((payment) => {
    rows.push([
      "payment",
      payment.note || "Recorded payment",
      payment.date,
      "",
      "",
      payment.amount,
      invoice.currency,
    ]);
  });

  (invoice.paymentInfo.methods || []).forEach((method) => {
    rows.push([
      "payment_method",
      method.label || method.type,
      methodDetail(method),
      "",
      "",
      "",
      "",
    ]);
  });

  if (invoice.paymentInfo.paymentLink) {
    rows.push([
      "payment_method",
      "payment_link",
      invoice.paymentInfo.paymentLink,
      "",
      "",
      "",
      "",
    ]);
  }

  if (invoice.paymentInfo.paymentNote) {
    rows.push([
      "payment_method",
      "payment_note",
      invoice.paymentInfo.paymentNote,
      "",
      "",
      "",
      "",
    ]);
  }

  if (invoice.notes) {
    rows.push(["notes", "notes", invoice.notes, "", "", "", ""]);
  }

  rows.push(
    ["total", "subtotal", "", "", "", subtotal, invoice.currency],
    ["total", "tax", `${invoice.taxRate || 0}%`, "", "", tax, invoice.currency],
    ["total", "total", "", "", "", total, invoice.currency]
  );

  if (adjustmentTotal > 0) {
    rows.push([
      "total",
      "adjusted_due",
      "",
      "",
      "",
      adjustedTotal,
      invoice.currency,
    ]);
  }

  if (amountPaid > 0) {
    rows.push(
      ["total", "paid", "", "", "", amountPaid, invoice.currency],
      ["total", "balance", "", "", "", balance, invoice.currency]
    );
  } else {
    rows.push([
      "total",
      adjustmentTotal > 0 ? "balance_due" : "total_due",
      "",
      "",
      "",
      adjustmentTotal > 0 ? balance : total,
      invoice.currency,
    ]);
  }

  return toCsv(rows);
}

export function downloadInvoiceCsv(invoice: Invoice) {
  const csv = buildInvoiceCsv(invoice);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `${invoice.invoiceNumber}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
