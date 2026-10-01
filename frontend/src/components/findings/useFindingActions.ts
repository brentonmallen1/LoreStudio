import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { sectionPath } from "../../lib/routes";
import { useAIAvailable } from "../../lib/mode";
import { useAIStore } from "../../stores/aiStore";
import { usePanelStore } from "../../stores/panelStore";
import { useStoryStore } from "../../stores/storyStore";
import type { MentionedRef } from "../../types/mentions";
import type { Finding } from "../../types/findings";

/** The Lorebook section an entity anchor opens, in anchor order. */
const SHEETS = [
  ["character_id", "characters"],
  ["location_id", "places"],
  ["thread_id", "threads"],
  ["twist_id", "twists"],
] as const;

/**
 * What a finding's verb does, shared by the Findings page, the This scene card and the
 * sheets' Health cards (doc 12 P4). The label is null when the verb is not available here:
 * "Ask about this" in Writer mode, or "Open the scene" from inside that scene.
 */
export function useFindingActions() {
  const navigate = useNavigate();
  const storyId = useStoryStore((s) => s.activeStory?.id);
  const activeNodeId = useStoryStore((s) => s.activeNode?.id);
  const aiAvailable = useAIAvailable();

  const verb = useCallback(
    (f: Finding, here?: "scene"): string | null => {
      switch (f.action) {
        case "open_scene":
          return here === "scene" && f.anchor.node_id === activeNodeId ? null : "Open the scene";
        case "open_chapter":
          return "Open the chapter";
        case "open_sheet":
          return SHEETS.some(([key]) => f.anchor[key]) ? "Open the sheet" : "Open Story Identity";
        case "fix":
          return f.fix ? `Change to “${f.fix.new}”` : null;
        case "ask":
          return aiAvailable ? "Ask about this" : f.run_id ? "Read the run" : null;
      }
    },
    [activeNodeId, aiAvailable],
  );

  const openScene = useCallback(
    (nodeId: string) => {
      if (!storyId) return;
      // The panel's This scene tab carries the scene's findings: show it on arrival.
      const panel = usePanelStore.getState();
      panel.setSide("writing");
      panel.activate("scene");
      navigate(`/stories/${storyId}/write/${nodeId}`);
    },
    [navigate, storyId],
  );

  const openSheet = useCallback(
    (f: Finding) => {
      if (!storyId) return;
      const sheet = SHEETS.find(([key]) => f.anchor[key]);
      navigate(
        sheet
          ? sectionPath(storyId, "lorebook", sheet[1], f.anchor[sheet[0]] ?? undefined)
          : sectionPath(storyId, "lorebook", "identity"),
      );
    },
    [navigate, storyId],
  );

  const readRun = useCallback(
    (f: Finding) => {
      if (storyId && f.run_id) navigate(`/stories/${storyId}/chronicle?item=log:${f.run_id}`);
    },
    [navigate, storyId],
  );

  /** An Assistant conversation that opens on the finding, with what it is about @mentioned. */
  const ask = useCallback(
    async (f: Finding) => {
      if (!storyId) return;
      const { createSession, setMentionedRefs, sendMessage } = useAIStore.getState();
      const session = await createSession("assistant", { storyId, nodeId: f.anchor.node_id ?? undefined });
      const refs: MentionedRef[] = [];
      if (f.anchor.node_id)
        refs.push({ kind: "scene", id: f.anchor.node_id, label: f.where || "This scene" });
      if (f.anchor.character_id) refs.push({ kind: "character", id: f.anchor.character_id, label: f.where });
      if (f.anchor.location_id) refs.push({ kind: "location", id: f.anchor.location_id, label: f.where });
      if (f.anchor.thread_id) refs.push({ kind: "thread", id: f.anchor.thread_id, label: f.where });
      if (refs.length) setMentionedRefs(session.id, refs);
      const evidence = f.evidence ? `\n\n“${f.evidence}”` : "";
      sendMessage(
        session.id,
        `A check flagged this${f.where ? ` in ${f.where}` : ""}: ${f.text}${evidence}\n\nWhat do you make of it?`,
      );
    },
    [storyId],
  );

  /** The verb, for everything but "fix", which asks first (the row does that). */
  const run = useCallback(
    (f: Finding) => {
      const node = f.anchor.node_id;
      if ((f.action === "open_scene" || f.action === "fix") && node) return openScene(node);
      if (f.action === "open_chapter" && node && storyId)
        return navigate(`/stories/${storyId}/write/${node}`);
      if (f.action === "open_sheet") return openSheet(f);
      if (f.action === "ask") return aiAvailable ? void ask(f) : readRun(f);
    },
    [aiAvailable, ask, navigate, openScene, openSheet, readRun, storyId],
  );

  return { verb, run, ask, readRun, openScene, aiAvailable };
}
