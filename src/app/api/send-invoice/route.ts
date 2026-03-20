import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { buildInvoiceEmailHtml } from "@/lib/emailTemplates";
import { buildPublicInvoicePath } from "@/lib/helpers";
import { EmailSenderSettings, Invoice } from "@/lib/types";

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
    const { to, subject, message, invoice, senderSettings } = body as {
      to?: string;
      subject?: string;
      message?: string;
      invoice?: Invoice;
      senderSettings?: EmailSenderSettings;
    };

    if (!to || !subject || !invoice) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    const publicUrl =
      invoice?.publicEnabled && invoice?.publicToken
        ? `${req.nextUrl.origin}${buildPublicInvoicePath(invoice.publicToken)}`
        : undefined;
    const plainMessage = message?.trim() || "";

    const { data, error } = await resend.emails.send({
      from: buildFromAddress(senderSettings, invoice),
      to: [to],
      subject: subject,
      text: plainMessage,
      html: buildInvoiceEmailHtml(invoice, plainMessage, publicUrl),
      replyTo: senderSettings?.fromEmail?.trim() || undefined,
    });

    if (error) {
      console.error("Resend error:", error);
      return NextResponse.json(
        { success: false, error: error.message || "Email delivery failed" },
        { status: 500 }
      );
    }

    console.log(`✉️ Invoice ${invoice.invoiceNumber} sent to ${to} — ID: ${data?.id}`);

    return NextResponse.json({
      success: true,
      message: `Invoice ${invoice.invoiceNumber} sent to ${to}`,
      emailId: data?.id,
    });
  } catch (error) {
    console.error("Email send error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to send email" },
      { status: 500 }
    );
  }
}
