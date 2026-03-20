import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import {
  buildInvoiceEmailHtml,
  buildReminderMessage,
  buildReminderSubject,
} from "@/lib/emailTemplates";
import { buildPublicInvoicePath } from "@/lib/helpers";
import { EmailSenderSettings, Invoice, ReminderRule } from "@/lib/types";

const resend = new Resend(process.env.RESEND_API_KEY);
const fallbackFromEmail =
  process.env.INVOICE_FROM_EMAIL || "Dru Studio Lab <drustudiolab@gmail.com>";

function buildFromAddress(
  senderSettings?: EmailSenderSettings,
  invoice?: Invoice
): string {
  const senderEmail = senderSettings?.fromEmail?.trim();
  const senderName =
    senderSettings?.fromName?.trim() || invoice?.business?.name || "Dru Studio Lab";

  if (!senderEmail) {
    return fallbackFromEmail;
  }

  return `${senderName} <${senderEmail}>`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { to, invoice, rule, senderSettings } = body as {
      to?: string;
      invoice?: Invoice;
      rule?: ReminderRule;
      senderSettings?: EmailSenderSettings;
    };

    if (!to || !invoice) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    const subject = buildReminderSubject(invoice, rule);
    const message = buildReminderMessage(invoice, rule);
    const publicUrl =
      invoice.publicEnabled && invoice.publicToken
        ? `${req.nextUrl.origin}${buildPublicInvoicePath(invoice.publicToken)}`
        : undefined;

    const { data, error } = await resend.emails.send({
      from: buildFromAddress(senderSettings, invoice),
      to: [to],
      subject,
      text: message,
      html: buildInvoiceEmailHtml(invoice, message, publicUrl),
      replyTo: senderSettings?.fromEmail?.trim() || undefined,
    });

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message || "Email delivery failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      emailId: data?.id,
      subject,
      message,
    });
  } catch (error) {
    console.error("Reminder send error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to send reminder" },
      { status: 500 }
    );
  }
}
