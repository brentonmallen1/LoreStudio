/**
 * The desktop app's shell (desktop/src-tauri), when this page is inside it. In a browser, the
 * Docker image and a checkout there is none, and `inDesktopApp()` is false.
 */
import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export const inDesktopApp = (): boolean => isTauri();

/**
 * Install and restart: download the latest release's app, check its signature, replace this
 * one and open it. Resolves false when the release has no app for this platform yet; on
 * success the app restarts and the promise never settles. `onProgress` gets the fraction
 * downloaded, or null while the size is unknown.
 */
export async function installUpdate(onProgress: (fraction: number | null) => void): Promise<boolean> {
  const stop = await listen<[number, number | null]>("update-progress", ({ payload: [received, total] }) =>
    onProgress(total ? received / total : null),
  );
  try {
    return await invoke<boolean>("install_update");
  } finally {
    stop();
  }
}
