"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Shell from "@/components/Shell";
import { getInvoice } from "@/lib/store";
import { useHydrated } from "@/lib/useHydrated";

const InvoicePreview = dynamic(() => import("@/components/InvoicePreview"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-[60vh]">
      <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  ),
});

export default function InvoiceDetailPage() {
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
      <InvoicePreview invoice={invoice} />
    </Shell>
  );
}
