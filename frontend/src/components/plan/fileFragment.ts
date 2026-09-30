import { api } from "../../api/client";
import { questionsApi } from "../../api/planning";
import { addPlannedScene } from "../../lib/planning/plannedScene";
import { useStoryStore } from "../../stores/storyStore";
import type { Location } from "../../types";
import type { FiledKind, IdeaFragment } from "../../types/planning";

export type FileChoice =
  | { kind: "character"; name: string; existingId?: string }
  | { kind: "place"; name: string; existing?: Location }
  | { kind: "scene"; title: string }
  | { kind: "question" }
  | { kind: "theme"; theme: string }
  | { kind: "logline" | "premise" | "conflict" };

export const FILE_KINDS: { kind: FiledKind; label: string; hint: string }[] = [
  { kind: "character", label: "Character", hint: "A person: new, or a note on one you have" },
  { kind: "place", label: "Place", hint: "A location: new, or added to one you have" },
  { kind: "scene", label: "Scene", hint: "A planned scene at the end of the story" },
  { kind: "question", label: "Question", hint: "Something you haven't decided yet" },
  { kind: "theme", label: "Theme", hint: "What the story is about underneath" },
  { kind: "logline", label: "Logline", hint: "The story in one sentence" },
  { kind: "premise", label: "Premise", hint: "The situation the story starts from" },
  { kind: "conflict", label: "Conflict", hint: "The pressure that drives it" },
];

function appended(current: string, text: string): string {
  return current.trim() ? `${current.trimEnd()}\n\n${text}` : text;
}

/**
 * File one piece of the brain dump into the story, and say what it became. Nothing is
 * invented: the author's own words go where they chose, and a filed piece keeps a link
 * to what it made so the Idea page can show it.
 */
export async function fileFragment(
  storyId: string,
  fragment: IdeaFragment,
  choice: FileChoice,
): Promise<NonNullable<IdeaFragment["filed"]>> {
  const store = useStoryStore.getState();
  const text = fragment.text.trim();
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
      return { kind: "character", ref_id: saved.id, label: saved.name };
    }
    case "place": {
      const saved = choice.existing
        ? await api.updateLocation(choice.existing.id, {
            description: appended(choice.existing.description ?? "", text),
          })
        : await api.createLocation(storyId, { name: choice.name.trim(), description: text });
      return { kind: "place", ref_id: saved.id, label: saved.name };
    }
    case "scene": {
      const result = await addPlannedScene(storyId, { title: choice.title, synopsis: text });
      if ("hint" in result) throw new Error(result.hint);
      return { kind: "scene", ref_id: result.node.id, label: result.node.title };
    }
    case "question": {
      const q = await questionsApi.create(storyId, text);
      return { kind: "question", ref_id: q.id, label: "Open question" };
    }
    case "theme": {
      const story = store.activeStory;
      const theme = choice.theme.trim();
      const themes = story?.themes ?? [];
      if (!themes.includes(theme))
        store.setActiveStory(await api.updateStory(storyId, { themes: [...themes, theme] }));
      return { kind: "theme", ref_id: null, label: theme };
    }
    default: {
      const field = choice.kind === "conflict" ? "central_conflict" : choice.kind;
      const current = store.activeStory?.[field] ?? "";
      // One logline: the piece replaces it. Premise and conflict gather paragraphs.
      const value = field === "logline" ? text : appended(current, text);
      store.setActiveStory(await api.updateStory(storyId, { [field]: value }));
      const labels = { logline: "Logline", premise: "Premise", central_conflict: "Central conflict" };
      return { kind: choice.kind, ref_id: null, label: labels[field] };
    }
  }
}
