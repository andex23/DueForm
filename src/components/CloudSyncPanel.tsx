"use client";

import { useEffect, useState } from "react";
import {
  Cloud,
  Download,
  Loader2,
  LogIn,
  LogOut,
  Upload,
  UserRoundPlus,
} from "lucide-react";
import toast from "react-hot-toast";
import { Session } from "@supabase/supabase-js";
import { exportWorkspaceData, importWorkspaceData } from "@/lib/store";
import {
  ACCESS_MODE_CHANGED_EVENT,
  downloadWorkspaceSnapshot,
  getCloudClient,
  getLastCloudSyncAt,
  isCloudConfigured,
  isGuestModeEnabled,
  setGuestModeEnabled,
  uploadWorkspaceSnapshot,
} from "@/lib/cloud";
import { formatDate } from "@/lib/helpers";
import { clearWorkspaceData } from "@/lib/store";

export default function CloudSyncPanel() {
  const configured = isCloudConfigured();
  const [session, setSession] = useState<Session | null>(null);
  const [guestMode, setGuestMode] = useState(() => isGuestModeEnabled());
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loadingAuth, setLoadingAuth] = useState(false);
  const [syncing, setSyncing] = useState<"upload" | "download" | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(getLastCloudSyncAt());
  const panelClass =
    "rounded-[12px] border border-border bg-bg-card p-6 shadow-[0_8px_20px_rgba(0,0,0,0.12)]";
  const secondaryPanelClass =
    "rounded-[10px] border border-border bg-bg-elevated/60";

  useEffect(() => {
    const handleAccessModeChanged = () => {
      setGuestMode(isGuestModeEnabled());
    };

    const client = getCloudClient();
    if (!client) {
      window.addEventListener(ACCESS_MODE_CHANGED_EVENT, handleAccessModeChanged);

      return () => {
        window.removeEventListener(
          ACCESS_MODE_CHANGED_EVENT,
          handleAccessModeChanged
        );
      };
    }

    client.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    window.addEventListener(ACCESS_MODE_CHANGED_EVENT, handleAccessModeChanged);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener(
        ACCESS_MODE_CHANGED_EVENT,
        handleAccessModeChanged
      );
    };
  }, []);

  const handleSignIn = async () => {
    const client = getCloudClient();
    if (!client) {
      toast.error("Cloud mode is not configured");
      return;
    }

    setLoadingAuth(true);
    const { error } = await client.auth.signInWithPassword({ email, password });
    setLoadingAuth(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Signed in");
  };

  const handleSignUp = async () => {
    const client = getCloudClient();
    if (!client) {
      toast.error("Cloud mode is not configured");
      return;
    }

    setLoadingAuth(true);
    const { error } = await client.auth.signUp({ email, password });
    setLoadingAuth(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Account created. You can now sign in.");
  };

  const handleSignOut = async () => {
    const client = getCloudClient();
    if (!client) return;

    const { error } = await client.auth.signOut();
    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Signed out");
  };

  const handleLeaveGuestMode = () => {
    clearWorkspaceData();
    setGuestModeEnabled(false);
    window.location.reload();
  };

  const handleUpload = async () => {
    if (!session?.user.id) {
      toast.error("Sign in first");
      return;
    }

    try {
      setSyncing("upload");
      const snapshot = exportWorkspaceData();
      const { error } = await uploadWorkspaceSnapshot(session.user.id, snapshot);

      if (error) {
        toast.error(
          `${error.message}. Apply the SQL in supabase/schema.sql if the table does not exist.`
        );
        return;
      }

      const syncedAt = new Date().toISOString();
      setLastSyncAt(syncedAt);
      toast.success("Workspace uploaded to cloud");
    } catch (error) {
      console.error(error);
      toast.error("Failed to upload workspace");
    } finally {
      setSyncing(null);
    }
  };

  const handleDownload = async () => {
    if (!session?.user.id) {
      toast.error("Sign in first");
      return;
    }

    try {
      setSyncing("download");
      const { data, error } = await downloadWorkspaceSnapshot(session.user.id);

      if (error) {
        toast.error(
          `${error.message}. Apply the SQL in supabase/schema.sql if the table does not exist.`
        );
        return;
      }

      if (!data?.payload) {
        toast.error("No cloud workspace found for this account");
        return;
      }

      importWorkspaceData(data.payload);
      setLastSyncAt(data.updated_at || new Date().toISOString());
      toast.success("Cloud workspace loaded");
      window.location.reload();
    } catch (error) {
      console.error(error);
      toast.error("Failed to download workspace");
    } finally {
      setSyncing(null);
    }
  };

  if (!configured) {
    return (
      <div className={panelClass}>
        <div className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.15em] text-accent mb-3">
          <Cloud size={15} />
          Cloud Sync
        </div>
        <p className="text-[13px] text-text-muted leading-relaxed m-0">
          Cloud auth and backup are built but not configured in this workspace.
          Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
          then apply `supabase/schema.sql` in your Supabase project.
        </p>
      </div>
    );
  }

  return (
    <div className={panelClass}>
      <div className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.15em] text-accent mb-3">
        <Cloud size={15} />
        Cloud Sync
      </div>

      {guestMode && !session ? (
        <div className={`${secondaryPanelClass} space-y-4 px-5 py-5`}>
          <p className="text-[13px] text-text-muted leading-relaxed m-0">
            You are currently using a temporary guest workspace. Nothing in this
            session is backed up or kept after you leave guest mode.
          </p>
          <button
            onClick={handleLeaveGuestMode}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border text-text-muted hover:text-accent hover:border-accent/30 text-[13px] font-medium transition-all cursor-pointer bg-transparent"
          >
            <LogIn size={14} />
            Sign In Or Create Account
          </button>
        </div>
      ) : !session ? (
        <div className={`${secondaryPanelClass} space-y-4 px-5 py-5`}>
          <p className="text-[13px] text-text-muted leading-relaxed m-0">
            Sign in with Supabase to back up invoices to the cloud and restore
            them on another device.
          </p>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-text-dim mb-1.5">
              Email
            </label>
            <input
              className="w-full bg-bg-input border border-border rounded-lg px-3.5 py-2.5 text-[14px] text-text outline-none focus:border-accent/50"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-text-dim mb-1.5">
              Password
            </label>
            <input
              type="password"
              className="w-full bg-bg-input border border-border rounded-lg px-3.5 py-2.5 text-[14px] text-text outline-none focus:border-accent/50"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 6 characters"
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleSignIn}
              disabled={loadingAuth}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-accent text-bg text-[13px] font-semibold hover:bg-accent-hover transition-all cursor-pointer border-0 disabled:opacity-50"
            >
              {loadingAuth ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <LogIn size={14} />
              )}
              Sign In
            </button>
            <button
              onClick={handleSignUp}
              disabled={loadingAuth}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border text-text-muted hover:text-accent hover:border-accent/30 text-[13px] font-medium transition-all cursor-pointer bg-transparent disabled:opacity-50"
            >
              <UserRoundPlus size={14} />
              Create Account
            </button>
          </div>
        </div>
      ) : (
        <div className={`${secondaryPanelClass} space-y-4 px-5 py-5`}>
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-[14px] font-semibold text-text">
                Signed in as {session.user.email}
              </div>
              <div className="text-[12px] text-text-dim mt-1">
                {lastSyncAt
                  ? `Last cloud sync ${formatDate(lastSyncAt)}`
                  : "No cloud sync yet"}
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-text-muted hover:text-danger hover:border-danger/30 text-[12px] font-medium transition-all cursor-pointer bg-transparent"
            >
              <LogOut size={14} />
              Sign Out
            </button>
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <button
              onClick={handleUpload}
              disabled={syncing !== null}
              className="flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-3 text-[13px] font-semibold text-bg transition-all hover:bg-accent-hover disabled:opacity-50"
            >
              {syncing === "upload" ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Upload size={14} />
              )}
              Upload Local Workspace
            </button>
            <button
              onClick={handleDownload}
              disabled={syncing !== null}
              className="flex items-center justify-center gap-2 rounded-lg border border-border bg-transparent px-4 py-3 text-[13px] font-medium text-text-muted transition-all hover:border-accent/30 hover:text-accent disabled:opacity-50"
            >
              {syncing === "download" ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Download size={14} />
              )}
              Download Cloud Workspace
            </button>
          </div>

          <p className="text-[12px] text-text-dim leading-relaxed m-0">
            Upload pushes your current local invoices, clients, services,
            businesses, and payment defaults to the cloud. Download replaces the
            local workspace with the cloud copy.
          </p>
        </div>
      )}
    </div>
  );
}
