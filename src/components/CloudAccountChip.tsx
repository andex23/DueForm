"use client";

import { useEffect, useState } from "react";
import { Session } from "@supabase/supabase-js";
import { ArrowRight, LogOut } from "lucide-react";
import toast from "react-hot-toast";
import { clearWorkspaceData } from "@/lib/store";
import {
  ACCESS_MODE_CHANGED_EVENT,
  getCloudClient,
  isCloudConfigured,
  isGuestModeEnabled,
  setGuestModeEnabled,
} from "@/lib/cloud";

export default function CloudAccountChip() {
  const configured = isCloudConfigured();
  const [session, setSession] = useState<Session | null>(null);
  const [guestMode, setGuestMode] = useState(() => isGuestModeEnabled());

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

  const handleReturnToAccount = () => {
    clearWorkspaceData();
    setGuestModeEnabled(false);
    window.location.reload();
  };

  if (!configured) {
    return null;
  }

  if (!session?.user.email && !guestMode) {
    return null;
  }

  if (guestMode && !session?.user.email) {
    return (
      <div className="border-t border-border px-7 py-4">
        <div className="mb-2 text-[10px] uppercase tracking-[0.18em] text-accent">
          Guest Session
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[13px] font-medium text-text">Temporary workspace</div>
            <div className="mt-0.5 text-[11px] text-text-dim">
              Nothing is saved after this session
            </div>
          </div>
          <button
            onClick={handleReturnToAccount}
            className="flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-[11px] font-medium text-text-dim transition-all hover:border-accent/30 hover:text-accent"
          >
            Sign in
            <ArrowRight size={13} />
          </button>
        </div>
      </div>
    );
  }

  const userEmail = session?.user.email;

  return (
    <div className="px-7 py-4 border-t border-border">
      <div className="text-[10px] uppercase tracking-[0.18em] text-text-dim mb-2">
        Signed In
      </div>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[13px] font-medium text-text truncate">
            {userEmail}
          </div>
          <div className="text-[11px] text-text-dim mt-0.5">
            Cloud workspace
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-text-dim hover:text-danger hover:border-danger/30 transition-all cursor-pointer bg-transparent"
        >
          <LogOut size={14} />
        </button>
      </div>
    </div>
  );
}
