import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UpdateStatus } from "../types/system";

const status = (over: Partial<UpdateStatus> = {}): UpdateStatus => ({
  current: "2026.10.3",
  latest: null,
  available: false,
  url: null,
  published_at: null,
  checked_at: null,
  error: null,
  install: "docker",
  automatic: false,
  ...over,
});

const updateStatus = vi.fn(() => Promise.resolve(status()));
const checkForUpdate = vi.fn(() => Promise.resolve(status({ latest: "2026.10.4", available: true })));
vi.mock("../api/system", () => ({
  systemApi: { updateStatus: () => updateStatus(), checkForUpdate: () => checkForUpdate() },
}));

const { useUpdateStore } = await import("./updateStore");

describe("whether a newer LoreStudio is out", () => {
  beforeEach(() => {
    useUpdateStore.setState({ status: null, checking: false });
    updateStatus.mockClear();
    checkForUpdate.mockClear();
  });

  it("reads the last answer once a visit, never asking GitHub", async () => {
    await useUpdateStore.getState().load();
    await useUpdateStore.getState().load();
    expect(updateStatus).toHaveBeenCalledTimes(1);
    expect(checkForUpdate).not.toHaveBeenCalled();
    expect(useUpdateStore.getState().status?.current).toBe("2026.10.3");
  });

  it("says nothing when the status cannot be read (signed out, offline)", async () => {
    updateStatus.mockRejectedValueOnce(new Error("401"));
    await useUpdateStore.getState().load();
    expect(useUpdateStore.getState().status).toBeNull();
  });

  it("checks now, keeps the answer and is checking only meanwhile", async () => {
    const pending = useUpdateStore.getState().check();
    expect(useUpdateStore.getState().checking).toBe(true);
    const found = await pending;
    expect(found.available).toBe(true);
    expect(useUpdateStore.getState()).toMatchObject({ checking: false, status: { latest: "2026.10.4" } });
  });

  it("stops checking when the check fails", async () => {
    checkForUpdate.mockRejectedValueOnce(new Error("offline"));
    await expect(useUpdateStore.getState().check()).rejects.toThrow("offline");
    expect(useUpdateStore.getState().checking).toBe(false);
  });
});
