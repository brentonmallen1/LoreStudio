import { api } from "../../api/client";
import { addPlannedScene } from "../../lib/planning/plannedScene";
import { useStoryStore } from "../../stores/storyStore";
import type { Location } from "../../types";

export type FileChoice =
  | { kind: "character"; name: string; existingId?: string }
  | { kind: "place"; name: string; existing?: Location }
  | { kind: "scene"; title: string }
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
      const result = await addPlannedScene(storyId, { title: choice.title, synopsis: text });
      if ("hint" in result) throw new Error(result.hint);
      return { ref: `scene:${result.node.id}`, label: result.node.title };
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
