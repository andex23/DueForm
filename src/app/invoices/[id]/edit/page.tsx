"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Shell from "@/components/Shell";
import InvoiceForm from "@/components/InvoiceForm";
import { getInvoice } from "@/lib/store";
import { useHydrated } from "@/lib/useHydrated";

export default function EditInvoicePage() {
  const params = useParams();
  const router = useRouter();
  const hydrated = useHydrated();
  const invoice = hydrated ? getInvoice(params.id as string) : null;

  useEffect(() => {
    if (hydrated && !invoice) {
      router.replace("/");
    }
  }, [hydrated, invoice, router]);

  if (!hydrated || !invoice) {
    return (
      <Shell>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <InvoiceForm existingInvoice={invoice} />
    </Shell>
  );
}
