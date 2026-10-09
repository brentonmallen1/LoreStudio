import { findRoute } from "../routes";
import { canOpenBeside } from "./pages";
import { launcherOf, type EntityKind, type PanelTab } from "../../types/panel";

/**
 * What comes back of a story's panel from `ls_panel:<storyId>` (doc 24 D11). Anything can
 * be in there: the shape from before the rail launched and the tabs held (`activeTabId`, a
 * "scene" tab, "tool:…" tabs, a tool since renamed), a hand-edited value, or nothing. Tools are
 * not tabs any more, so a tool tab is dropped, and a tool that was showing comes back showing,
 * from the rail. Whatever cannot be read falls back to This scene.
 */
export interface RestoredPanel {
  tabs: PanelTab[];
  /** A launcher id ("scene", "assistant", "tool:notes") or the id of one of `tabs`. */
  showing: string;
}

const KINDS: EntityKind[] = ["character", "location", "thread", "twist", "compendium"];

function asTab(raw: unknown): PanelTab | null {
  if (!raw || typeof raw !== "object") return null;
  const t = raw as Record<string, unknown>;
  if (
    t.kind === "entity" &&
    typeof t.id === "string" &&
    typeof t.entityId === "string" &&
    typeof t.label === "string" &&
    KINDS.includes(t.entityKind as EntityKind)
  ) {
    return {
      id: t.id,
      kind: "entity",
      entityKind: t.entityKind as EntityKind,
      entityId: t.entityId,
      label: t.label,
    };
  }
  if (t.kind === "page" && typeof t.id === "string" && typeof t.routeId === "string") {
    const route = findRoute(t.routeId);
    if (!route || !canOpenBeside(route)) return null;
    const path = typeof t.path === "string" && t.path.startsWith(route.path) ? t.path : route.path;
    return { id: t.id, kind: "page", routeId: t.routeId, path };
  }
  return null;
}

export function restorePanel(raw: unknown): RestoredPanel {
  const saved = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const seen = new Set<string>();
  const tabs: PanelTab[] = [];
  for (const item of Array.isArray(saved.tabs) ? saved.tabs : []) {
    const tab = asTab(item);
    if (tab && !seen.has(tab.id)) {
      seen.add(tab.id);
      tabs.push(tab);
    }
  }
  const wanted =
    typeof saved.showing === "string"
      ? saved.showing
      : typeof saved.activeTabId === "string"
        ? saved.activeTabId
        : "scene";
  const showing = launcherOf(wanted) || seen.has(wanted) ? wanted : "scene";
  return { tabs, showing };
}
