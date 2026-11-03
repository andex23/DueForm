import { NextRequest } from "next/server";
import { sendInvoiceEmail } from "@/lib/sendInvoiceEmail";

export async function POST(req: NextRequest) {
  return sendInvoiceEmail(req, true);
}
