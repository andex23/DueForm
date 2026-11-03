import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoice } from "./fixtures";
import type { WorkspaceSnapshot } from "../src/lib/types";

const client = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => client }));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key");
});

describe("public cloud access", () => {
  it("looks up only the exact token through the guarded RPC", async () => {
    const shared = invoice();
    client.rpc.mockResolvedValue({ data: shared, error: null });
    const { getPublicInvoiceFromCloud } = await import("../src/lib/cloud");
    expect(await getPublicInvoiceFromCloud("inv_aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa")).toEqual(shared);
    expect(client.rpc).toHaveBeenCalledWith("get_public_invoice", { share_token: "inv_aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa" });
    expect(client.from).not.toHaveBeenCalled();
  });

  it("fails closed without falling back to public table access", async () => {
    client.rpc.mockResolvedValue({ data: null, error: { message: "RPC unavailable" } });
    const { getPublicInvoiceFromCloud } = await import("../src/lib/cloud");
    await expect(getPublicInvoiceFromCloud("inv_aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa")).rejects.toThrow("Could not load");
    expect(client.from).not.toHaveBeenCalled();
  });

  it("does not report sync success when stale share discovery fails", async () => {
    const failure = { data: null, error: { message: "Permission denied" }, status: 403 };
    const workspace = { upsert: vi.fn().mockResolvedValue({ data: null, error: null }) };
    const shares = { select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue(failure) }) };
    client.from.mockImplementation((table) => table === "invoice_workspaces" ? workspace : shares);
    const { uploadWorkspaceSnapshot } = await import("../src/lib/cloud");
    expect(await uploadWorkspaceSnapshot("owner", { invoices: [invoice()] } as WorkspaceSnapshot)).toEqual(failure);
    expect(client.from).toHaveBeenCalledTimes(2);
  });
});

describe("ordered workspace uploads", () => {
  it("queues overlapping uploads and preserves the snapshot at invocation", async () => {
    let finishFirst!: () => void;
    const firstPending = new Promise<void>((resolve) => { finishFirst = resolve; });
    const writes: WorkspaceSnapshot[] = [];
    const workspace = { upsert: vi.fn(async ({ payload }: { payload: WorkspaceSnapshot }) => {
      writes.push(payload);
      if (writes.length === 1) await firstPending;
      return { data: null, error: null };
    }) };
    const shares = {
      select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) }),
      delete: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) }),
    };
    client.from.mockImplementation((table) => table === "invoice_workspaces" ? workspace : shares);
    const { uploadWorkspaceSnapshot } = await import("../src/lib/cloud");
    const firstSnapshot = { invoices: [invoice({ publicEnabled: false, notes: "older" })] } as WorkspaceSnapshot;
    const secondSnapshot = { invoices: [invoice({ publicEnabled: false, notes: "newer" })] } as WorkspaceSnapshot;
    const first = uploadWorkspaceSnapshot("owner", firstSnapshot);
    const second = uploadWorkspaceSnapshot("owner", secondSnapshot);
    secondSnapshot.invoices[0].notes = "mutated after enqueue";
    await Promise.resolve();
    await Promise.resolve();
    expect(writes).toHaveLength(1);
    finishFirst();
    await Promise.all([first, second]);
    expect(writes.map((snapshot) => snapshot.invoices[0].notes)).toEqual(["older", "newer"]);
  });

  it("continues with the next snapshot after a rejected upload", async () => {
    const workspace = { upsert: vi.fn()
      .mockRejectedValueOnce(new Error("Network failed"))
      .mockResolvedValue({ data: null, error: null }) };
    const shares = {
      select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) }),
      delete: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) }),
    };
    client.from.mockImplementation((table) => table === "invoice_workspaces" ? workspace : shares);
    const { uploadWorkspaceSnapshot } = await import("../src/lib/cloud");
    const snapshot = { invoices: [] } as unknown as WorkspaceSnapshot;
    const first = uploadWorkspaceSnapshot("owner", snapshot);
    const second = uploadWorkspaceSnapshot("owner", snapshot);
    await expect(first).rejects.toThrow("Network failed");
    await expect(second).resolves.toMatchObject({ error: null });
    expect(workspace.upsert).toHaveBeenCalledTimes(2);
  });
});
