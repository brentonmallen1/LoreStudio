/**
 * Save a file the server sent: its name from Content-Disposition, else `fallback`. In the
 * desktop app the webview's download opens the Save dialog (desktop/src-tauri, #53).
 */
export async function saveResponse(res: Response, fallback: string): Promise<void> {
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail ?? `Export failed (${res.status})`);
  }
  const match = (res.headers.get("Content-Disposition") ?? "").match(/filename="([^"]+)"/);
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = match?.[1] ?? fallback;
  a.click();
  URL.revokeObjectURL(url);
}
