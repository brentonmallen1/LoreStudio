import { api } from "../../api/client";
import { trayApi } from "../../api/tray";
import type { PlaceSpot } from "../../lib/outline/place";
import { addPlannedScene } from "../../lib/planning/plannedScene";
import { reloadStructure } from "../../lib/story/loadStory";
import { useStoryStore } from "../../stores/storyStore";
import type { Location } from "../../types";

export type FileChoice =
  | { kind: "character"; name: string; existingId?: string }
  | { kind: "place"; name: string; existing?: Location }
  /** Plan a scene (the words are what happens) or start one (they are its first draft), at a spot. */
  | { kind: "scene"; title: string; how?: "plan" | "start"; spot?: PlaceSpot | null }
  /** Keep the words as an idea in the Outline's Not placed yet tray (doc 29 D9). */
  | { kind: "idea" }
  | { kind: "theme"; theme: string }
  | { kind: "logline" | "premise" | "conflict" };

function appended(current: string, text: string): string {
  return current.trim() ? `${current.trimEnd()}\n\n${text}` : text;
}

/** What words became: the `ref` its mark carries, and a name to show for it. */
export interface Made {
  ref: string;
  label: string;
}

/**
 * Make words from the Freewrite page into part of the story (doc 15 N3; the Ideas page's
 * filing, doc 10 P2). Nothing is invented: the author's own words go where they chose.
 */
export async function makeFrom(storyId: string, words: string, choice: FileChoice): Promise<Made> {
  const store = useStoryStore.getState();
  const text = words.trim();
  switch (choice.kind) {
    case "character": {
      // The words go in as a discovery note, from "Your ideas", on a new or existing character.
      const note = {
        id: crypto.randomUUID(),
        text,
        scene_id: null,
        scene_title: "Your ideas",
        timestamp: new Date().toISOString(),
        confirmed: true,
      };
      const existing = store.characters.find((c) => c.id === choice.existingId);
      const saved = existing
        ? await api.updateCharacter(existing.id, {
            discovery_notes: [...(existing.discovery_notes ?? []), note],
          })
        : await api.createCharacter(storyId, {
            name: choice.name.trim(),
            role: store.characters.length === 0 ? "protagonist" : "deuteragonist",
            discovery_notes: [note],
          });
      store.upsertCharacter(saved);
      return { ref: `character:${saved.id}`, label: saved.name };
    }
    case "place": {
      const saved = choice.existing
        ? await api.updateLocation(choice.existing.id, {
            description: appended(choice.existing.description ?? "", text),
          })
        : await api.createLocation(storyId, { name: choice.name.trim(), description: text });
      store.setLocations([...store.locations.filter((l) => l.id !== saved.id), saved]);
      return { ref: `place:${saved.id}`, label: saved.name };
    }
    case "scene": {
      const how = choice.how ?? "plan";
      if (!choice.spot) {
        // Nowhere to put it yet (an empty story): the outline starts, and this is its first scene.
        const result = await addPlannedScene(storyId, {
          title: choice.title,
          synopsis: how === "plan" ? text : "",
        });
        if ("hint" in result) throw new Error(result.hint);
        if (how === "start")
          await api.updateNode(result.node.id, { content: asProse(text), status: "draft" });
        return { ref: `${how === "plan" ? "scene" : "draft"}:${result.node.id}`, label: result.node.title };
      }
      const { spot } = choice;
      const node = await api.createNode(storyId, {
        title: choice.title,
        ...(how === "plan"
          ? { synopsis: text, status: "planned" as const }
          : { content: asProse(text), status: "draft" as const }),
        parent_id: spot.parentId,
        level: spot.depth,
        level_type: spot.levelType,
        position: spot.position,
        insert: true,
      });
      await reloadStructure();
      return { ref: `${how === "plan" ? "scene" : "draft"}:${node.id}`, label: node.title };
    }
    case "idea": {
      const item = await trayApi.add(storyId, text);
      return { ref: `idea:${item.id}`, label: "Not placed yet" };
    }
    case "theme": {
      const story = store.activeStory;
      const theme = choice.theme.trim();
      const themes = story?.themes ?? [];
      if (!themes.includes(theme))
        store.setActiveStory(await api.updateStory(storyId, { themes: [...themes, theme] }));
      return { ref: `theme:${theme}`, label: theme };
    }
    default: {
      const field = choice.kind === "conflict" ? "central_conflict" : choice.kind;
      const current = store.activeStory?.[field] ?? "";
      // One logline: the piece replaces it. Premise and conflict gather paragraphs.
      const value = field === "logline" ? text : appended(current, text);
      store.setActiveStory(await api.updateStory(storyId, { [field]: value }));
      const labels = { logline: "Logline", premise: "Premise", central_conflict: "Central conflict" };
      return { ref: choice.kind, label: labels[field] };
    }
  }
}

/** Words from the page as a scene's first draft: a paragraph for each line, escaped. */
export function asProse(text: string): string {
  const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<p>${esc(line)}</p>`)
    .join("");
}
