"use client";

import { useEffect, useRef, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import {
  ArrowRight,
  FileText,
  Loader2,
  LogIn,
  Sparkles,
  UserRoundPlus,
  WalletCards,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  clearWorkspaceData,
  exportWorkspaceData,
  importWorkspaceData,
  WORKSPACE_CHANGED_EVENT,
} from "@/lib/store";
import {
  ACCESS_MODE_CHANGED_EVENT,
  downloadWorkspaceSnapshot,
  getCloudClient,
  isCloudConfigured,
  isGuestModeEnabled,
  setGuestModeEnabled,
  uploadWorkspaceSnapshot,
} from "@/lib/cloud";
import ThemeSwitcher from "./ThemeSwitcher";
import ScrollReveal from "./ScrollReveal";
import { WorkspaceSnapshot } from "@/lib/types";

type AuthView = "signin" | "signup";

const authInputClass =
  "w-full rounded-lg border border-border bg-bg-elevated px-4 py-3.5 text-[15px] text-text placeholder:text-text-dim/75 outline-none transition-all duration-200 focus:border-accent focus:ring-2 focus:ring-accent/15";

const featureRows = [
  {
    icon: FileText,
    title: "Create polished invoices fast",
    body: "Build clean invoice pages and export ready-to-send PDFs in minutes.",
  },
  {
    icon: WalletCards,
    title: "Track payment details clearly",
    body: "Capture payment methods, balances, and overdue states in one workspace.",
  },
  {
    icon: Sparkles,
    title: "Reuse repeat work",
    body: "Keep clients, saved items, and previous invoices close for faster billing.",
  },
] as const;

function buildStarterWorkspace(user: User): WorkspaceSnapshot {
  const fullName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name.trim()
      : "";
  const businessName =
    typeof user.user_metadata?.business_name === "string"
      ? user.user_metadata.business_name.trim()
      : "";

  return {
    version: 1,
    counter: 0,
    invoices: [],
    businesses: [
      {
        id: "default",
        name: businessName || fullName || "Your Business",
        email: user.email || "",
        phone: "",
        address: "",
        website: "",
        tagline: fullName ? `Managed by ${fullName}` : "Creative Studio",
        isDefault: true,
      },
    ],
    clients: [],
    services: [],
    paymentInfo: {
      methods: [],
      paymentLink: "",
      paymentNote: "",
    },
    emailSender: {
      fromName: businessName || fullName || "Your Business",
      fromEmail: user.email || "",
    },
    exportedAt: new Date().toISOString(),
  };
}

export default function AuthGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const configured = isCloudConfigured();
  const [session, setSession] = useState<Session | null | undefined>(() =>
    configured ? undefined : null
  );
  const [guestMode, setGuestMode] = useState(() => isGuestModeEnabled());
  const [workspaceReady, setWorkspaceReady] = useState(!configured);
  const [view, setView] = useState<AuthView>("signin");
  const [fullName, setFullName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authLoading, setAuthLoading] = useState<"signin" | "signup" | null>(
    null
  );
  const [resetLoading, setResetLoading] = useState(false);
  const suppressSyncRef = useRef(false);
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleAccessModeChanged = () => {
      setGuestMode(isGuestModeEnabled());
    };

    window.addEventListener(ACCESS_MODE_CHANGED_EVENT, handleAccessModeChanged);

    return () => {
      window.removeEventListener(
        ACCESS_MODE_CHANGED_EVENT,
        handleAccessModeChanged
      );
    };
  }, []);

  useEffect(() => {
    const client = getCloudClient();
    if (!client) {
      setSession(null);
      setWorkspaceReady(true);
      return;
    }

    client.auth.getSession().then(({ data }) => {
      if (data.session) {
        setGuestModeEnabled(false);
      }
      setSession(data.session);
    });

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, nextSession) => {
      if (nextSession) {
        setGuestModeEnabled(false);
      }
      setSession(nextSession);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!configured || session === undefined) {
      return;
    }

    if (guestMode) {
      setWorkspaceReady(true);
      return;
    }

    if (!session) {
      suppressSyncRef.current = true;
      clearWorkspaceData();
      suppressSyncRef.current = false;
      setWorkspaceReady(true);
      return;
    }

    const activeSession = session;
    const userId = activeSession.user.id;
    let cancelled = false;

    async function loadWorkspace() {
      setWorkspaceReady(false);
      suppressSyncRef.current = true;

      try {
        const { data, error } = await downloadWorkspaceSnapshot(userId);

        if (cancelled) return;

        if (error && error.code !== "PGRST116") {
          toast.error(
            `${error.message}. Apply supabase/schema.sql in your Supabase project.`
          );
          clearWorkspaceData();
        } else if (data?.payload) {
          importWorkspaceData(data.payload);
        } else {
          importWorkspaceData(buildStarterWorkspace(activeSession.user));
        }
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          toast.error("Could not load this user's cloud workspace");
          clearWorkspaceData();
        }
      } finally {
        if (!cancelled) {
          suppressSyncRef.current = false;
          setWorkspaceReady(true);
        }
      }
    }

    loadWorkspace();

    return () => {
      cancelled = true;
      suppressSyncRef.current = false;
    };
  }, [configured, guestMode, session]);

  useEffect(() => {
    if (!configured || guestMode || !session?.user.id) {
      return;
    }

    const handleWorkspaceChanged = () => {
      if (suppressSyncRef.current) {
        return;
      }

      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }

      syncTimeoutRef.current = setTimeout(async () => {
        try {
          const snapshot = exportWorkspaceData();
          const { error } = await uploadWorkspaceSnapshot(
            session.user.id,
            snapshot
          );
          if (error) {
            console.error("Cloud upload failed", error);
          }
        } catch (error) {
          console.error("Cloud upload failed", error);
        }
      }, 700);
    };

    window.addEventListener(WORKSPACE_CHANGED_EVENT, handleWorkspaceChanged);

    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
      window.removeEventListener(WORKSPACE_CHANGED_EVENT, handleWorkspaceChanged);
    };
  }, [configured, guestMode, session?.user.id]);

  const handleSignIn = async () => {
    const client = getCloudClient();
    if (!client) return;
    if (!email.trim()) {
      toast.error("Enter your email address");
      return;
    }
    if (!password.trim()) {
      toast.error("Enter your password");
      return;
    }

    setAuthLoading("signin");
    const { error } = await client.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setAuthLoading(null);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Signed in");
  };

  const handleSignUp = async () => {
    const client = getCloudClient();
    if (!client) return;
    if (!fullName.trim()) {
      toast.error("Enter your full name");
      return;
    }
    if (!businessName.trim()) {
      toast.error("Enter your business name");
      return;
    }
    if (!email.trim()) {
      toast.error("Enter your email address");
      return;
    }
    if (!password.trim()) {
      toast.error("Enter a password");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setAuthLoading("signup");
    const { data, error } = await client.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          full_name: fullName.trim(),
          business_name: businessName.trim(),
        },
      },
    });
    setAuthLoading(null);

    if (error) {
      if (error.code === "email_address_invalid") {
        toast.error("Use a real email address you can access");
        return;
      }
      toast.error(error.message);
      return;
    }

    if (data.session) {
      toast.success("Account created and signed in");
      return;
    }

    toast.success("Account created. Check your email to confirm it before signing in.");
    setView("signin");
  };

  const handleForgotPassword = async () => {
    const client = getCloudClient();
    if (!client) return;
    if (!email.trim()) {
      toast.error("Enter your email first");
      return;
    }

    setResetLoading(true);
    const redirectTo =
      typeof window !== "undefined"
        ? `${window.location.origin}/auth/reset-password`
        : undefined;
    const { error } = await client.auth.resetPasswordForEmail(email.trim(), {
      redirectTo,
    });
    setResetLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Password reset email sent");
  };

  const handleContinueAsGuest = () => {
    setGuestModeEnabled(true);
    clearWorkspaceData();
    setWorkspaceReady(true);
    toast.success("Guest mode enabled. This session won't be saved.");
  };

  if (!configured) {
    return <>{children}</>;
  }

  if (session === undefined || (!workspaceReady && !guestMode)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-6 w-6 rounded-full border-2 border-accent border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!session && !guestMode) {
    const isSigningIn = view === "signin";

    return (
      <div className="relative min-h-screen overflow-hidden bg-bg px-4 py-4 sm:px-8 sm:py-8 lg:px-10">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.015),transparent_24%)]" />
          <div className="absolute left-[8%] top-[12%] h-[260px] w-[260px] rounded-full bg-accent/7 blur-3xl" />
          <div className="absolute right-[8%] bottom-[10%] h-[240px] w-[240px] rounded-full bg-accent-dim blur-3xl" />
        </div>

        <div className="relative mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-[1350px] items-start lg:min-h-[calc(100vh-4rem)] lg:items-center">
          <div className="absolute right-0 top-0 z-20 hidden sm:block">
            <ThemeSwitcher compact className="w-[290px]" />
          </div>

          <div className="grid w-full gap-6 rounded-[12px] border border-border/80 bg-[linear-gradient(160deg,rgba(18,19,22,0.96),rgba(11,11,12,0.94))] p-4 shadow-[0_16px_42px_rgba(0,0,0,0.24)] sm:gap-8 sm:p-8 lg:grid-cols-[minmax(0,1.06fr)_minmax(420px,560px)] lg:p-10">
            <section className="order-1 flex flex-col justify-between gap-7 px-1 py-1 sm:gap-8 sm:px-4 lg:px-6">
              <div>
                <div className="inline-flex flex-col items-start">
                  <span className="font-[family-name:var(--font-display)] text-[28px] font-semibold tracking-[-0.04em] text-text sm:text-[32px]">
                    DueForm
                  </span>
                  <span className="mt-1 text-[11px] font-medium uppercase tracking-[0.24em] text-text-dim">
                    Invoice Workspace
                  </span>
                  <span className="mt-4 h-px w-16 bg-accent/55" />
                </div>

                <ScrollReveal delay={40} className="mt-7 max-w-[560px] sm:mt-10">
                  <p className="m-0 text-[12px] font-semibold uppercase tracking-[0.26em] text-accent">
                    Multi-user invoicing
                  </p>
                  <h1 className="m-0 mt-4 max-w-[12ch] font-[family-name:var(--font-display)] text-[36px] font-semibold leading-[0.96] tracking-[-0.035em] text-text sm:mt-5 sm:max-w-[11ch] sm:text-[58px]">
                    Create invoices, send PDFs, track payments.
                  </h1>
                  <p className="m-0 mt-4 max-w-[490px] text-[15px] leading-6 text-text-muted sm:mt-5 sm:text-[16px] sm:leading-7">
                    A calmer invoice workflow for freelancers, studios, and small
                    teams who want polished billing without the usual clutter.
                  </p>
                </ScrollReveal>

                <div className="mt-7 max-w-[560px] space-y-3 sm:mt-10 sm:space-y-4">
                  {featureRows.map((item, index) => {
                    const Icon = item.icon;

                    return (
                      <ScrollReveal
                        key={item.title}
                        delay={90 + index * 70}
                      >
                        <div className="flex items-start gap-3 rounded-[10px] border border-border/70 bg-bg-card/70 px-4 py-3.5 sm:gap-4 sm:py-4">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-dim text-accent">
                            <Icon size={16} />
                          </div>
                          <div>
                            <div className="text-[15px] font-semibold text-text">
                              {item.title}
                            </div>
                            <p className="m-0 mt-1 text-[13px] leading-6 text-text-muted">
                              {item.body}
                            </p>
                          </div>
                        </div>
                      </ScrollReveal>
                    );
                  })}
                </div>
              </div>

              <ScrollReveal
                delay={180}
                className="hidden max-w-[560px] md:block"
              >
                <div className="rounded-[12px] border border-border bg-[linear-gradient(180deg,rgba(23,25,29,0.92),rgba(15,16,19,0.92))] p-4 shadow-[0_10px_24px_rgba(0,0,0,0.18)] sm:p-5">
                <div className="rounded-[10px] border border-[#e7e2d7]/85 bg-[#fbf8f2] px-4 py-5 text-[#1f1c18] shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] sm:px-5 sm:py-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-['Courier_New',monospace] text-[0.78rem] font-bold uppercase tracking-[0.24em] text-accent">
                        Invoice
                      </div>
                      <div className="mt-3 font-['Courier_New',monospace] text-[1.5rem] font-bold tracking-[-0.04em] text-[#15120f]">
                        DSL-0001
                      </div>
                    </div>
                    <div className="text-right font-['Courier_New',monospace] text-[0.82rem] font-semibold leading-6 text-[#5a544c]">
                      <div>Mar 20, 2026</div>
                      <div>Due Apr 19, 2026</div>
                    </div>
                  </div>

                  <div className="mt-6 h-px bg-[#e7dfd3]" />

                  <div className="mt-5 grid gap-5 sm:grid-cols-[1fr_220px]">
                    <div>
                      <div className="font-['Courier_New',monospace] text-[0.72rem] font-bold uppercase tracking-[0.26em] text-accent">
                        Bill To
                      </div>
                      <div className="mt-3 font-['Courier_New',monospace] text-[1rem] font-bold text-[#15120f]">
                        Pahokee Home
                      </div>
                      <div className="mt-2 space-y-1 font-['Courier_New',monospace] text-[0.82rem] font-semibold leading-6 text-[#655e56]">
                        <div>andrewjuniorja@gmail.com</div>
                        <div>+63 927 954 6284</div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between border-b border-[#ece5db] pb-2 font-['Courier_New',monospace] text-[0.82rem] font-semibold text-[#655e56]">
                        <span>Subtotal</span>
                        <span>$800.00</span>
                      </div>
                      <div className="flex items-center justify-between border-b border-[#ece5db] pb-2 font-['Courier_New',monospace] text-[0.82rem] font-semibold text-[#655e56]">
                        <span>Tax (0%)</span>
                        <span>$0.00</span>
                      </div>
                      <div className="flex items-end justify-between pt-1 font-['Courier_New',monospace]">
                        <span className="text-[0.95rem] font-bold text-[#2f2b26]">
                          Total Due
                        </span>
                        <span className="text-[1.6rem] font-bold tracking-[-0.04em] text-accent">
                          $800.00
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                </div>
              </ScrollReveal>
            </section>

            <section className="order-2 flex items-start justify-center lg:items-center">
              <ScrollReveal delay={40} className="w-full max-w-[560px]">
                <div className="rounded-[12px] border border-border bg-[linear-gradient(180deg,rgba(18,19,22,0.98),rgba(15,17,20,0.98))] p-5 shadow-[0_14px_34px_rgba(0,0,0,0.24)] sm:p-10">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-accent">
                      {isSigningIn ? "Account access" : "New workspace"}
                    </div>
                    <h2 className="m-0 mt-4 font-[family-name:var(--font-display)] text-[36px] font-semibold leading-none tracking-[-0.03em] text-text sm:text-[40px]">
                      {isSigningIn ? "Sign in" : "Create your account"}
                    </h2>
                    <p className="m-0 mt-3 max-w-[30ch] text-[15px] leading-6 text-text-muted">
                      {isSigningIn
                        ? "Access your invoices, clients, and payment history."
                        : "Start creating professional invoices in minutes."}
                    </p>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-[10px] border border-border bg-accent-dim text-accent">
                    {isSigningIn ? <LogIn size={20} /> : <UserRoundPlus size={20} />}
                  </div>
                </div>

                <div className="mt-5 sm:hidden">
                  <ThemeSwitcher compact />
                </div>

                <div className="mt-8 rounded-[10px] border border-border bg-bg-elevated p-1.5">
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      onClick={() => setView("signin")}
                      className={`rounded-lg px-4 py-2.5 text-[13px] font-semibold transition-all ${
                        isSigningIn
                          ? "bg-accent text-[#0e141b] shadow-lg shadow-black/15"
                          : "text-text-muted hover:text-text"
                      }`}
                    >
                      Sign in
                    </button>
                    <button
                      onClick={() => setView("signup")}
                      className={`rounded-lg px-4 py-2.5 text-[13px] font-semibold transition-all ${
                        !isSigningIn
                          ? "bg-accent text-[#0e141b] shadow-lg shadow-black/15"
                          : "text-text-muted hover:text-text"
                      }`}
                    >
                      Create account
                    </button>
                  </div>
                </div>

                <div className="mt-7 space-y-4 sm:mt-8 sm:space-y-5">
                  {!isSigningIn && (
                    <>
                      <div>
                        <label className="mb-2.5 block text-[12px] font-semibold tracking-[0.04em] text-text-muted">
                          Full name
                        </label>
                        <input
                          className={authInputClass}
                          value={fullName}
                          onChange={(event) => setFullName(event.target.value)}
                          placeholder="Jane Doe"
                          autoComplete="name"
                        />
                      </div>
                      <div>
                        <label className="mb-2.5 block text-[12px] font-semibold tracking-[0.04em] text-text-muted">
                          Business name
                        </label>
                        <input
                          className={authInputClass}
                          value={businessName}
                          onChange={(event) => setBusinessName(event.target.value)}
                          placeholder="Doe Studio"
                          autoComplete="organization"
                        />
                      </div>
                    </>
                  )}

                  <div>
                    <label className="mb-2.5 block text-[12px] font-semibold tracking-[0.04em] text-text-muted">
                      Email
                    </label>
                    <input
                      type="email"
                      className={authInputClass}
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="you@example.com"
                      autoComplete="email"
                    />
                  </div>

                  <div>
                    <div className="mb-2.5 flex items-center justify-between gap-3">
                      <label className="block text-[12px] font-semibold tracking-[0.04em] text-text-muted">
                        Password
                      </label>
                      {isSigningIn && (
                        <button
                          onClick={handleForgotPassword}
                          disabled={resetLoading}
                          className="text-[12px] font-medium text-accent transition-colors hover:text-accent-hover disabled:opacity-60"
                        >
                          {resetLoading ? "Sending..." : "Forgot password"}
                        </button>
                      )}
                    </div>
                    <input
                      type="password"
                      className={authInputClass}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="At least 6 characters"
                      autoComplete={isSigningIn ? "current-password" : "new-password"}
                    />
                  </div>
                </div>

                <button
                  onClick={isSigningIn ? handleSignIn : handleSignUp}
                  disabled={authLoading !== null || resetLoading}
                  className="mt-8 flex h-[54px] w-full items-center justify-center gap-2 rounded-lg bg-accent px-5 text-[15px] font-semibold text-[#0e141b] transition-all hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {authLoading === (isSigningIn ? "signin" : "signup") ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : isSigningIn ? (
                    <LogIn size={16} />
                  ) : (
                    <UserRoundPlus size={16} />
                  )}
                  {isSigningIn ? "Sign in" : "Create account"}
                </button>

                <div className="mt-5 text-center text-[13px] text-text-muted">
                  {isSigningIn ? "Don’t have an account?" : "Already have an account?"}{" "}
                  <button
                    onClick={() => setView(isSigningIn ? "signup" : "signin")}
                    className="font-semibold text-accent transition-colors hover:text-accent-hover"
                  >
                    {isSigningIn ? "Create one" : "Sign in"}
                  </button>
                </div>

                <div className="mt-6 border-t border-border pt-5 text-center">
                  <button
                    onClick={handleContinueAsGuest}
                    className="inline-flex items-center gap-2 text-[13px] font-medium text-text-muted transition-colors hover:text-accent"
                  >
                    Continue in guest mode
                    <ArrowRight size={14} />
                  </button>
                  <p className="m-0 mt-2 text-[12px] leading-5 text-text-dim">
                    Temporary access only. Data stays in this tab and is not saved to the cloud.
                  </p>
                </div>

                <p className="m-0 mt-5 text-[12px] leading-6 text-text-dim">
                  Use a real email address. New accounts may need email confirmation before sign-in works.
                </p>
                </div>
              </ScrollReveal>
            </section>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
