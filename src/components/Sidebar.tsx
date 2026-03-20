"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Plus,
  Settings,
  LayoutDashboard,
  X,
} from "lucide-react";
import CloudAccountChip from "./CloudAccountChip";
import ThemeSwitcher from "./ThemeSwitcher";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/invoices/new", label: "New Invoice", icon: Plus },
  { href: "/settings", label: "Settings", icon: Settings },
];

interface SidebarProps {
  mobile?: boolean;
  onNavigate?: () => void;
  onClose?: () => void;
}

export default function Sidebar({
  mobile = false,
  onNavigate,
  onClose,
}: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={`flex flex-col border-r border-border bg-bg-elevated ${
        mobile
          ? "h-full w-[292px]"
          : "fixed bottom-0 left-0 top-0 z-20 hidden w-[260px] lg:flex"
      }`}
    >
      <div className="px-6 pb-5 pt-6">
        <div className="flex items-start justify-between gap-4">
          <Link href="/" className="block no-underline" onClick={onNavigate}>
            <h1 className="m-0 font-[family-name:var(--font-display)] text-[22px] font-semibold tracking-tight text-text">
              DueForm
            </h1>
            <span className="mt-1 block text-[11px] font-medium uppercase tracking-[0.2em] text-text-dim">
              Invoice Workspace
            </span>
          </Link>

          {mobile && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-transparent text-text-dim transition-all hover:border-border-hover hover:text-text"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="mx-5 h-px bg-gradient-to-r from-accent/40 via-accent/10 to-transparent mb-4" />

      <nav className="flex-1 px-4 space-y-1">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`
                flex items-center gap-3 px-3 py-2.5 rounded-lg text-[14px] font-medium no-underline
                transition-all duration-200
                ${
                  isActive
                    ? "bg-accent/10 text-accent"
                    : "text-text-muted hover:text-text hover:bg-white/[0.03]"
                }
              `}
            >
              <Icon size={18} strokeWidth={isActive ? 2 : 1.5} />
              {item.label}
              {item.href === "/invoices/new" && (
                <span className="ml-auto w-5 h-5 rounded-md bg-accent/20 flex items-center justify-center">
                  <Plus size={12} className="text-accent" />
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="px-4 pb-4">
        <ThemeSwitcher compact />
      </div>

      <CloudAccountChip />

      <div className="border-t border-border px-6 py-5">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-accent" />
          <span className="text-[11px] text-text-dim tracking-wide">v3.0.0</span>
        </div>
      </div>
    </aside>
  );
}
