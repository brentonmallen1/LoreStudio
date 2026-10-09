import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useToastStore } from "../../stores/toastStore";
import { useUpdateStore } from "../../stores/updateStore";
import type { UpdateStatus } from "../../types/system";

const shell = vi.hoisted(() => ({ inside: true, install: vi.fn() }));
vi.mock("../../lib/desktop", () => ({
  inDesktopApp: () => shell.inside,
  installUpdate: (onProgress: (f: number | null) => void) => shell.install(onProgress),
}));

const { default: AboutSection } = await import("./AboutSection");

const status = (over: Partial<UpdateStatus> = {}): UpdateStatus => ({
  current: "2026.10.3",
  latest: "2026.10.4",
  available: true,
  url: null,
  published_at: null,
  checked_at: null,
  error: null,
  install: "desktop",
  automatic: false,
  ...over,
});

function show(over: Partial<UpdateStatus> = {}) {
  useUpdateStore.setState({ status: status(over), checking: false, load: async () => {} });
  render(<AboutSection />);
}

describe("About and updates in the desktop app", () => {
  beforeEach(() => {
    shell.inside = true;
    shell.install.mockReset();
    useToastStore.setState({ toasts: [] });
  });

  it("offers Install and restart, and shows the download as it goes", async () => {
    let report: (f: number | null) => void = () => {};
    shell.install.mockImplementation((onProgress) => {
      report = onProgress;
      return new Promise(() => {}); // the app restarts; it never returns
    });
    show();
    fireEvent.click(screen.getByRole("button", { name: "Install and restart" }));
    expect((await screen.findByRole<HTMLButtonElement>("button", { name: "Downloading…" })).disabled).toBe(
      true,
    );
    act(() => report(0.42));
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Downloading… 42%" }).disabled).toBe(true);
  });

  it("says when the release's desktop app is not built yet", async () => {
    shell.install.mockResolvedValue(false);
    show();
    fireEvent.click(screen.getByRole("button", { name: "Install and restart" }));
    expect(
      (await screen.findByRole<HTMLButtonElement>("button", { name: "Install and restart" })).disabled,
    ).toBe(false);
    expect(useToastStore.getState().toasts[0].text).toMatch(/still being built/);
  });

  it("says why an install failed", async () => {
    shell.install.mockRejectedValue("signature mismatch");
    show();
    fireEvent.click(screen.getByRole("button", { name: "Install and restart" }));
    await screen.findByRole("button", { name: "Install and restart" });
    expect(useToastStore.getState().toasts[0]).toMatchObject({ tone: "error" });
    expect(useToastStore.getState().toasts[0].text).toMatch(/signature mismatch/);
  });

  it("offers nothing to install when up to date", () => {
    show({ available: false });
    expect(screen.queryByRole("button", { name: "Install and restart" })).toBeNull();
  });

  it("explains the download instead when the desktop app's page is open in a browser", () => {
    shell.inside = false;
    show();
    expect(screen.queryByRole("button", { name: "Install and restart" })).toBeNull();
    expect(screen.queryByText(/drag LoreStudio into/)).not.toBeNull();
  });
});
