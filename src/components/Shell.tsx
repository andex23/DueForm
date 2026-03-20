"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import AuthGate from "./AuthGate";
import Sidebar from "./Sidebar";

function getWorkspaceLabel(pathname: string): string {
  if (pathname.startsWith("/invoices/new")) {
    return "New Invoice";
  }
  if (pathname.startsWith("/invoices/") && pathname.endsWith("/edit")) {
    return "Edit Invoice";
  }
  if (pathname.startsWith("/invoices/")) {
    return "Invoice";
  }
  if (pathname.startsWith("/settings")) {
    return "Settings";
  }

  return "Dashboard";
}

export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpenPath, setMobileOpenPath] = useState<string | null>(null);
  const mobileOpen = mobileOpenPath === pathname;

  return (
    <AuthGate>
      <div className="min-h-screen bg-bg">
        <Sidebar />

        <div className="sticky top-0 z-30 border-b border-border bg-bg/92 backdrop-blur lg:hidden">
          <div className="flex items-center justify-between px-5 py-4">
            <div>
              <Link href="/" className="font-[family-name:var(--font-display)] text-[22px] font-semibold tracking-tight text-text no-underline">
                DueForm
              </Link>
              <div className="mt-1 text-[11px] font-medium uppercase tracking-[0.18em] text-text-dim">
                {getWorkspaceLabel(pathname)}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setMobileOpenPath(pathname)}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-bg-elevated text-text-muted transition-all hover:border-border-hover hover:text-text"
            >
              <Menu size={18} />
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <button
              type="button"
              aria-label="Close navigation overlay"
              onClick={() => setMobileOpenPath(null)}
              className="absolute inset-0 bg-black/58"
            />
            <div className="relative h-full">
              <Sidebar
                mobile
                onNavigate={() => setMobileOpenPath(null)}
                onClose={() => setMobileOpenPath(null)}
              />
            </div>
          </div>
        )}

        <main className="flex-1 px-4 py-4 sm:px-6 sm:py-6 lg:ml-[260px] lg:p-8 xl:p-10">
          {children}
        </main>
      </div>
    </AuthGate>
  );
}
