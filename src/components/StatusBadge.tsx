"use client";

import { InvoiceStatus } from "@/lib/types";
import { getStatusBg } from "@/lib/helpers";

export default function StatusBadge({ status }: { status: InvoiceStatus }) {
  return (
    <span
      className={`
        inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider border
        ${getStatusBg(status)}
      `}
    >
      {status === "partially_paid" ? "Partial" : status}
    </span>
  );
}
