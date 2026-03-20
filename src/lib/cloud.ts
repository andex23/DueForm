import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { Invoice, WorkspaceSnapshot } from "./types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const CLOUD_TABLE = "invoice_workspaces";
const PUBLIC_INVOICE_TABLE = "public_invoices";
const LAST_SYNC_KEY = "dru-cloud-last-sync";
const GUEST_MODE_KEY = "dru-guest-mode";
export const ACCESS_MODE_CHANGED_EVENT = "dru-access-mode-changed";

let browserClient: SupabaseClient | null | undefined;

function notifyAccessModeChanged(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(ACCESS_MODE_CHANGED_EVENT));
  }
}

export function isCloudConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

export function getCloudClient(): SupabaseClient | null {
  if (!isCloudConfigured()) {
    return null;
  }

  if (!browserClient) {
    browserClient = createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  }

  return browserClient;
}

export function isGuestModeEnabled(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return window.sessionStorage.getItem(GUEST_MODE_KEY) === "guest";
}

export function setGuestModeEnabled(enabled: boolean): void {
  if (typeof window === "undefined") {
    return;
  }

  if (enabled) {
    window.sessionStorage.setItem(GUEST_MODE_KEY, "guest");
  } else {
    window.sessionStorage.removeItem(GUEST_MODE_KEY);
  }

  notifyAccessModeChanged();
}

export async function uploadWorkspaceSnapshot(
  userId: string,
  snapshot: WorkspaceSnapshot
) {
  const client = getCloudClient();
  if (!client) {
    throw new Error("Cloud mode is not configured");
  }

  const workspaceResult = await client.from(CLOUD_TABLE).upsert(
    {
      user_id: userId,
      payload: snapshot,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: "user_id",
    }
  );

  if (workspaceResult.error) {
    return workspaceResult;
  }

  const publicInvoices = snapshot.invoices
    .filter((invoice) => invoice.publicEnabled && invoice.publicToken)
    .map((invoice) => ({
      token: invoice.publicToken as string,
      owner_id: userId,
      invoice,
      updated_at: new Date().toISOString(),
    }));

  const { data: existingRows } = await client
    .from(PUBLIC_INVOICE_TABLE)
    .select("token")
    .eq("owner_id", userId);

  const existingTokens = new Set((existingRows || []).map((row) => row.token));
  const nextTokens = new Set(publicInvoices.map((invoice) => invoice.token));
  const staleTokens = [...existingTokens].filter((token) => !nextTokens.has(token));

  if (publicInvoices.length > 0) {
    const publicUpsert = await client.from(PUBLIC_INVOICE_TABLE).upsert(publicInvoices, {
      onConflict: "token",
    });
    if (publicUpsert.error) {
      return {
        data: workspaceResult.data,
        error: publicUpsert.error,
        count: workspaceResult.count,
        status: publicUpsert.status,
        statusText: publicUpsert.statusText,
      };
    }
  }

  if (staleTokens.length > 0) {
    const deleteResult = await client
      .from(PUBLIC_INVOICE_TABLE)
      .delete()
      .in("token", staleTokens);
    if (deleteResult.error) {
      return {
        data: workspaceResult.data,
        error: deleteResult.error,
        count: workspaceResult.count,
        status: deleteResult.status,
        statusText: deleteResult.statusText,
      };
    }
  } else if (publicInvoices.length === 0) {
    const deleteAllResult = await client
      .from(PUBLIC_INVOICE_TABLE)
      .delete()
      .eq("owner_id", userId);
    if (deleteAllResult.error) {
      return {
        data: workspaceResult.data,
        error: deleteAllResult.error,
        count: workspaceResult.count,
        status: deleteAllResult.status,
        statusText: deleteAllResult.statusText,
      };
    }
  }

  if (typeof window !== "undefined") {
    window.localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
  }

  return workspaceResult;
}

export async function downloadWorkspaceSnapshot(userId: string) {
  const client = getCloudClient();
  if (!client) {
    throw new Error("Cloud mode is not configured");
  }

  return client
    .from(CLOUD_TABLE)
    .select("payload, updated_at")
    .eq("user_id", userId)
    .maybeSingle();
}

export async function getPublicInvoiceFromCloud(
  token: string
): Promise<Invoice | null> {
  const client = getCloudClient();
  if (!client) {
    return null;
  }

  const { data } = await client
    .from(PUBLIC_INVOICE_TABLE)
    .select("invoice")
    .eq("token", token)
    .maybeSingle();

  return (data?.invoice as Invoice | undefined) || null;
}

export function getLastCloudSyncAt(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(LAST_SYNC_KEY);
}
