import { Invoice, ReminderRule } from "./types";
import {
  calculateAmountPaid,
  calculateBalance,
  calculateTotal,
  formatCurrency,
  formatDate,
} from "./helpers";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatMultilineText(value: string): string {
  return escapeHtml(value).replaceAll("\n", "<br />");
}

function buildSummaryRows(invoice: Invoice): string {
  const total = calculateTotal(invoice.lineItems, invoice.taxRate);
  const paid = calculateAmountPaid(invoice.payments || []);
  const balance = calculateBalance(
    invoice.lineItems,
    invoice.taxRate,
    invoice.payments || []
  );

  const rows = [
    ["Invoice", invoice.invoiceNumber],
    ["Issued", formatDate(invoice.dateIssued)],
    ["Due", formatDate(invoice.dateDue)],
    ["Total", formatCurrency(total, invoice.currency)],
  ];

  if (paid > 0) {
    rows.push(["Paid", formatCurrency(paid, invoice.currency)]);
    rows.push(["Balance", formatCurrency(balance, invoice.currency)]);
  }

  return rows
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding: 10px 0; color: #69707a; font-size: 13px; letter-spacing: 0.02em;">${escapeHtml(
            label
          )}</td>
          <td style="padding: 10px 0; color: #111418; font-size: 13px; font-weight: 700; text-align: right;">${escapeHtml(
            value
          )}</td>
        </tr>
      `
    )
    .join("");
}

export function buildInvoiceEmailHtml(
  invoice: Invoice,
  message: string,
  publicUrl?: string
): string {
  return `
    <div style="font-family: 'Courier New', monospace; background: #f3f0ea; padding: 32px; color: #111418;">
      <div style="max-width: 640px; margin: 0 auto; background: #ffffff; border: 1px solid #d8dce1; border-radius: 12px; overflow: hidden; box-shadow: 0 14px 28px rgba(15, 18, 24, 0.08);">
        <div style="height: 4px; background: linear-gradient(90deg, #607285, #7c8fa3, #607285);"></div>
        <div style="padding: 32px 32px 28px;">
          <div style="display: flex; justify-content: space-between; gap: 24px; margin-bottom: 28px; padding-bottom: 24px; border-bottom: 1px solid #e5e8ec;">
            <div>
              <div style="font-family: Georgia, serif; font-size: 28px; font-weight: 700; color: #0f1318;">
                ${escapeHtml(invoice.business.name)}
              </div>
              <div style="margin-top: 8px; color: #69707a; font-size: 13px;">
                Invoice for ${escapeHtml(invoice.client.name)}
              </div>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; color: #8a919b;">
                Invoice
              </div>
              <div style="margin-top: 6px; color: #607285; font-size: 24px; font-weight: 700;">
                ${escapeHtml(invoice.invoiceNumber)}
              </div>
            </div>
          </div>

          <div style="font-size: 14px; line-height: 1.75; color: #313741;">
            ${formatMultilineText(message)}
          </div>

          <div style="margin-top: 28px; padding: 18px 20px; background: #f7f8fa; border: 1px solid #e1e5ea; border-radius: 10px;">
            <table style="width: 100%; border-collapse: collapse;">
              ${buildSummaryRows(invoice)}
            </table>
          </div>

          ${
            publicUrl
              ? `
            <div style="margin-top: 28px;">
              <a href="${escapeHtml(
                publicUrl
              )}" style="display: inline-block; padding: 12px 18px; border-radius: 8px; background: #111418; color: #f7f8fa; text-decoration: none; font-size: 13px; font-weight: 700; letter-spacing: 0.01em;">
                View Invoice Online
              </a>
            </div>
          `
              : ""
          }
        </div>
      </div>
    </div>
  `;
}

export function buildReminderSubject(
  invoice: Invoice,
  rule?: ReminderRule
): string {
  if (!rule) {
    return `Reminder: Invoice ${invoice.invoiceNumber}`;
  }

  if (rule.offsetDays < 0) {
    return `Upcoming due date: Invoice ${invoice.invoiceNumber}`;
  }

  if (rule.offsetDays === 0) {
    return `Invoice ${invoice.invoiceNumber} is due today`;
  }

  return `Overdue reminder: Invoice ${invoice.invoiceNumber}`;
}

export function buildReminderMessage(invoice: Invoice, rule?: ReminderRule): string {
  const balance = calculateBalance(
    invoice.lineItems,
    invoice.taxRate,
    invoice.payments || []
  );

  if (rule?.offsetDays === 0) {
    return `Hi ${invoice.client.name},\n\nThis is a reminder that invoice ${invoice.invoiceNumber} is due today (${formatDate(
      invoice.dateDue
    )}). The current balance is ${formatCurrency(
      balance,
      invoice.currency
    )}.\n\nThank you.`;
  }

  if ((rule?.offsetDays || 0) > 0) {
    return `Hi ${invoice.client.name},\n\nInvoice ${invoice.invoiceNumber} is now overdue. The outstanding balance is ${formatCurrency(
      balance,
      invoice.currency
    )}.\n\nPlease let us know once payment has been made.`;
  }

  return `Hi ${invoice.client.name},\n\nJust a heads-up that invoice ${invoice.invoiceNumber} will be due on ${formatDate(
    invoice.dateDue
  )}. The current balance is ${formatCurrency(
    balance,
    invoice.currency
  )}.\n\nThank you.`;
}
