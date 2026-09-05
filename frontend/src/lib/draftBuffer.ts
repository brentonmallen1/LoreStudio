/**
 * Local draft buffer for scene content, so a crashed tab or a failed save loses
 * nothing. IndexedDB when available (no size worries for long scenes), with an
 * in-memory fallback so callers never have to care.
 */

export interface Draft {
  nodeId: string;
  content: string;
  savedAt: number; // epoch ms
}

const DB_NAME = "lorestudio-drafts";
const STORE = "drafts";
const memory = new Map<string, Draft>();

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === "undefined") return resolve(null);
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE))
          req.result.createObjectStore(STORE, { keyPath: "nodeId" });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function run<T>(
  mode: IDBTransactionMode,
  op: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T | undefined> {
  return openDb().then(
    (db) =>
      new Promise((resolve) => {
        if (!db) return resolve(undefined);
        try {
          const req = op(db.transaction(STORE, mode).objectStore(STORE));
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => resolve(undefined);
        } catch {
          resolve(undefined);
        }
      }),
  );
}

export async function saveDraft(nodeId: string, content: string): Promise<void> {
  const draft: Draft = { nodeId, content, savedAt: Date.now() };
  memory.set(nodeId, draft);
  await run("readwrite", (s) => s.put(draft));
}

export async function loadDraft(nodeId: string): Promise<Draft | null> {
  const fromDb = (await run<Draft>("readonly", (s) => s.get(nodeId))) ?? null;
  return fromDb ?? memory.get(nodeId) ?? null;
}

export async function clearDraft(nodeId: string): Promise<void> {
  memory.delete(nodeId);
  await run("readwrite", (s) => s.delete(nodeId));
}
