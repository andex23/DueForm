"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LockKeyhole, Loader2 } from "lucide-react";
import { Session } from "@supabase/supabase-js";
import toast from "react-hot-toast";
import ThemeSwitcher from "@/components/ThemeSwitcher";
import { getCloudClient, isCloudConfigured } from "@/lib/cloud";

const inputClass =
  "w-full rounded-lg border border-border bg-bg-elevated px-4 py-3.5 text-[15px] text-text placeholder:text-text-dim/75 outline-none transition-all duration-200 focus:border-accent focus:ring-2 focus:ring-accent/15";

export default function ResetPasswordPage() {
  const router = useRouter();
  const configured = isCloudConfigured();
  const [session, setSession] = useState<Session | null | undefined>(() =>
    configured ? undefined : null
  );
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const client = getCloudClient();
    if (!client) {
      return;
    }

    client.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleUpdatePassword = async () => {
    const client = getCloudClient();
    if (!client) return;
    if (!password.trim()) {
      toast.error("Enter a new password");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setSaving(true);
    const { error } = await client.auth.updateUser({ password });
    setSaving(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Password updated");
    router.push("/");
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-bg px-5 py-8">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.015),transparent_24%)]" />
        <div className="absolute left-[-8%] top-[-12%] h-[320px] w-[320px] rounded-full bg-accent/10 blur-3xl" />
        <div className="absolute right-[-10%] bottom-[-18%] h-[360px] w-[360px] rounded-full bg-accent-dim blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-[1080px] items-center justify-center">
        <div className="absolute right-0 top-0 hidden sm:block">
          <ThemeSwitcher compact className="w-[290px]" />
        </div>

        <div className="w-full max-w-[560px] rounded-[12px] border border-border bg-[linear-gradient(180deg,rgba(18,19,22,0.98),rgba(15,17,20,0.98))] p-7 shadow-[0_14px_34px_rgba(0,0,0,0.24)] sm:p-10">
          <div className="flex items-start justify-between gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-[10px] border border-border bg-accent-dim text-accent">
              <LockKeyhole size={20} />
            </div>
            <div className="sm:hidden">
              <ThemeSwitcher compact />
            </div>
          </div>

          <p className="m-0 mt-6 text-[11px] font-semibold uppercase tracking-[0.24em] text-accent">
            Account recovery
          </p>
          <h1 className="m-0 mt-4 font-[family-name:var(--font-display)] text-[38px] font-semibold leading-none tracking-[-0.03em] text-text">
            Reset password
          </h1>
          <p className="m-0 mt-3 text-[15px] leading-6 text-text-muted">
            Choose a new password for your invoice workspace.
          </p>

          {!configured ? (
            <div className="mt-8 rounded-[10px] border border-border bg-bg-elevated/70 p-5 text-[14px] leading-6 text-text-muted">
              Cloud auth is not configured in this deployment, so password reset is unavailable.
            </div>
          ) : session === undefined ? (
            <div className="mt-8 flex items-center gap-3 rounded-[10px] border border-border bg-bg-elevated/70 p-5 text-[14px] text-text-muted">
              <Loader2 size={16} className="animate-spin text-accent" />
              Checking your recovery link...
            </div>
          ) : !session ? (
            <div className="mt-8 rounded-[10px] border border-border bg-bg-elevated/70 p-5">
              <p className="m-0 text-[14px] leading-6 text-text-muted">
                Open the password reset link from your email in this browser, then come back here to set a new password.
              </p>
              <Link
                href="/"
                className="mt-4 inline-flex text-[13px] font-semibold text-accent no-underline transition-colors hover:text-accent-hover"
              >
                Return to sign in
              </Link>
            </div>
          ) : (
            <div className="mt-8 space-y-4">
              <div>
                <label className="mb-2 block text-[12px] font-semibold tracking-[0.04em] text-text-muted">
                  New password
                </label>
                <input
                  type="password"
                  className={inputClass}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="At least 6 characters"
                />
              </div>
              <div>
                <label className="mb-2 block text-[12px] font-semibold tracking-[0.04em] text-text-muted">
                  Confirm password
                </label>
                <input
                  type="password"
                  className={inputClass}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Repeat your new password"
                />
              </div>

              <button
                onClick={handleUpdatePassword}
                disabled={saving}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-5 py-3.5 text-[15px] font-semibold text-[#0e141b] transition-all hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <LockKeyhole size={16} />
                )}
                Update password
              </button>

              <Link
                href="/"
                className="block text-center text-[13px] font-medium text-text-muted no-underline transition-colors hover:text-text"
              >
                Back to sign in
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
