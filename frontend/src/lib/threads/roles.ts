import { api } from "../../api/client";
import type { PlotThread, ThreadRole, ThreadStatus } from "../../types";

/**
 * What a scene does to a thread (doc 18 C1). A thread is one list of scenes, each with a role;
 * where it opens and closes and every try along the way are roles, and its status follows.
 */
export const ROLES: { value: ThreadRole; label: string; hint: string }[] = [
  {
    value: "opens",
    label: "opens it",
    hint: "The reader first feels the question, the place, the want or the trouble",
  },
  { value: "moves", label: "moves it on", hint: "Something changes for this thread" },
  { value: "turns", label: "turns it", hint: "It goes somewhere the reader did not expect" },
  { value: "complicates", label: "complicates it", hint: "It gets harder, or knottier" },
  { value: "fails", label: "a try fails", hint: "Someone tries to settle it and fails" },
  { value: "fails_worse", label: "fails, worse", hint: "A try fails and leaves things worse than before" },
  { value: "costs", label: "succeeds, at a cost", hint: "A try works, and someone pays for it" },
  { value: "succeeds", label: "a try succeeds", hint: "A try works cleanly" },
  {
    value: "closes",
    label: "closes it",
    hint: "The question is answered, the change made, the order restored",
  },
];

const BY_VALUE = new Map(ROLES.map((r) => [r.value, r]));

export const TRY_ROLES: ReadonlySet<ThreadRole> = new Set(["fails", "fails_worse", "costs", "succeeds"]);

export const roleLabel = (role: ThreadRole) => BY_VALUE.get(role)?.label ?? role;
export const roleHint = (role: ThreadRole) => BY_VALUE.get(role)?.hint ?? "";
export const isTry = (role: ThreadRole) => TRY_ROLES.has(role);

export const STATUS_LABELS: Record<ThreadStatus, string> = {
  planned: "Planned",
  open: "Open",
  resolved: "Resolved",
  set_aside: "Set aside",
};

/** What the status means, in a sentence, for the thread sheet. */
export function statusLine(thread: PlotThread, title: (id: string) => string): string {
  switch (thread.status) {
    case "planned":
      return "Planned: it is in no scene yet.";
    case "set_aside":
      return "Set aside: it stays here, but the checks leave it alone.";
    case "resolved":
      return `Resolved: it closes in ${title(thread.closes_at_node_id!)}.`;
    default:
      return thread.opens_at_node_id
        ? `Open: it opens in ${title(thread.opens_at_node_id)} and has no closing scene yet.`
        : "Open: it is in a scene, but no scene opens it yet.";
  }
}

/**
 * Make `nodeId` the scene that opens (or closes) the thread. The scene that held the role
 * before keeps its place on the thread and goes back to moving it on; null leaves it undecided.
 */
export async function setEndpoint(thread: PlotThread, role: "opens" | "closes", nodeId: string | null) {
  for (const a of thread.appearances) {
    if (a.role === role && a.node_id !== nodeId) {
      await api.updateThreadAppearance(thread.id, a.node_id, { role: "moves" });
    }
  }
  if (nodeId) await api.addThreadAppearance(thread.id, nodeId, { role });
}
