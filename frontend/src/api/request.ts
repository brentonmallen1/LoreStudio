/** Fetch wrapper shared by every API method: auth header, 401 redirect, typed errors. */

export const BASE = "/api";

/** Stable id for this browser tab; the change log uses it so undo reverses *your* edits. */
export function getClientId(): string {
  try {
    let id = sessionStorage.getItem("ls_client_id");
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem("ls_client_id", id);
    }
    return id;
  } catch {
    return "no-session-storage";
  }
}

/** Fired after every non-GET request completes, so undo state and lists can refresh. */
export const MUTATION_EVENT = "ls:mutation";

export function getToken() {
  return localStorage.getItem("ls_token");
}

/** Non-2xx response. `detail` is whatever the backend put in the body's `detail`. */
export class ApiError extends Error {
  status: number;
  detail: unknown;
  constructor(status: number, detail: unknown) {
    const message =
      typeof detail === "string"
        ? detail
        : detail && typeof detail === "object" && "message" in detail
          ? String((detail as { message: unknown }).message)
          : "Request failed";
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  headers["X-Client-Id"] = getClientId();

  const res = await fetch(`${BASE}${path}`, { ...init, headers });

  if (res.status === 401) {
    localStorage.removeItem("ls_token");
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new ApiError(res.status, body.detail ?? "Request failed");
  }

  const method = (init.method ?? "GET").toUpperCase();
  if (method !== "GET") window.dispatchEvent(new Event(MUTATION_EVENT));
  if (res.status === 204) return undefined as T;
  return res.json();
}
